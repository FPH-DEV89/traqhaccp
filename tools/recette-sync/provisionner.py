"""Banc d'essai de la synchronisation TraqHACCP.

Provisionne sur le projet Supabase REEL :
  · un utilisateur de test (GoTrue, e-mail confirmé) ;
  · un etablissement dedie ;
  · l'adhesion « gerant » qui ouvre les droits d'ecriture (can_write).

N'imprime AUCUN secret : les identifiants de test sont ecrits dans un fichier
0600 que le script Playwright relit.
"""
import json, os, pathlib, secrets, urllib.error, urllib.parse, urllib.request

SORTIE = pathlib.Path('/tmp/e2e-sync/identifiants.json')
SORTIE.parent.mkdir(parents=True, exist_ok=True)

def charger_env(chemin):
    vals = {}
    for ligne in pathlib.Path(chemin).read_text().splitlines():
        ligne = ligne.strip()
        if not ligne or ligne.startswith('#') or '=' not in ligne:
            continue
        cle, val = ligne.split('=', 1)
        vals[cle.strip()] = val.strip().strip('"').strip("'")
    return vals

env = charger_env('/opt/data/.env.supabase-traqhaccp')
URL = env['SUPABASE_URL'].rstrip('/')
SERVICE = env['SUPABASE_SERVICE_ROLE_KEY']

def appel(chemin, methode='GET', corps=None, entetes=None):
    donnees = json.dumps(corps).encode() if corps is not None else None
    tete = {'apikey': SERVICE, 'Authorization': f'Bearer {SERVICE}',
            'Content-Type': 'application/json'}
    if entetes:
        tete.update(entetes)
    req = urllib.request.Request(f'{URL}{chemin}', data=donnees, headers=tete, method=methode)
    try:
        with urllib.request.urlopen(req, timeout=30) as rep:
            brut = rep.read().decode()
            return rep.status, (json.loads(brut) if brut.strip() else None)
    except urllib.error.HTTPError as err:
        brut = err.read().decode()
        try:
            return err.code, json.loads(brut) if brut.strip() else None
        except json.JSONDecodeError:
            return err.code, brut

EMAIL = 'banc-sync@traqhaccp.test'

# 1) Utilisateur de test -------------------------------------------------------
MOT_DE_PASSE = secrets.token_urlsafe(18)

statut, reponse = appel('/auth/v1/admin/users', 'POST', {
    'email': EMAIL, 'password': MOT_DE_PASSE, 'email_confirm': True,
})
if statut in (200, 201):
    utilisateur = reponse
    print(f'utilisateur cree : {utilisateur["id"]}')
else:
    # Deja present : on le retrouve et on reinitialise son mot de passe.
    statut, liste = appel('/auth/v1/admin/users?per_page=200')
    utilisateur = next((u for u in (liste or {}).get('users', []) if u['email'] == EMAIL), None)
    if not utilisateur:
        raise SystemExit(f'utilisateur introuvable et creation refusee (HTTP {statut}) : {reponse}')
    statut, _ = appel(f"/auth/v1/admin/users/{utilisateur['id']}", 'PUT', {'password': MOT_DE_PASSE})
    print(f'utilisateur existant reutilise : {utilisateur["id"]} (mot de passe reinitialise, HTTP {statut})')

# 2) Etablissement dedie -------------------------------------------------------
NOM = "Banc d'essai synchronisation"
statut, etabs = appel(f"/rest/v1/establishments?select=id,name&name=eq.{urllib.parse.quote(NOM)}")
if etabs:
    etab_id = etabs[0]['id']
    print(f'etablissement reutilise : {etab_id}')
else:
    statut, cree = appel('/rest/v1/establishments', 'POST', {'name': NOM},
                         {'Prefer': 'return=representation'})
    if statut not in (200, 201):
        raise SystemExit(f'creation etablissement refusee (HTTP {statut}) : {cree}')
    etab_id = cree[0]['id']
    print(f'etablissement cree : {etab_id}')

# 3) Adhesion « gerant » (ouvre can_write et can_delete) -----------------------
statut, _ = appel('/rest/v1/memberships?on_conflict=user_id,establishment_id', 'POST',
                  {'user_id': utilisateur['id'], 'establishment_id': etab_id, 'role': 'gerant'},
                  {'Prefer': 'resolution=merge-duplicates,return=minimal'})
print(f'adhesion gerant : HTTP {statut}')

SORTIE.write_text(json.dumps({'email': EMAIL, 'motDePasse': MOT_DE_PASSE,
                              'etablissementId': etab_id, 'userId': utilisateur['id']}, indent=2))
os.chmod(SORTIE, 0o600)
print(f'identifiants du banc ecrits dans {SORTIE} (0600)')
