#!/usr/bin/env python3
"""push-guide-drive.py — Pousse le guide utilisateur TraqHACCP sur Google Drive
(Google Doc éditable + PDF imprimable), en CONSERVANT les fichiers existants
(même fileId -> même lien de partage), puis VÉRIFIE le résultat.

Chaîne complète :
    node tools/build-guide-doc.mjs                      # HTML autoportant (images en base64)
    python3 tools/push-guide-drive.py --token ... --doc-id ... --pdf-id ...
    node tools/build-guide-pdf.mjs                      # PDF local (npm run guide:pdf)

Usage :
  python3 tools/push-guide-drive.py \
      --token /opt/data/google_token.json \
      --doc-id  <fileId du Google Doc>  --pdf-id <fileId du PDF>   # mise à jour en place
  # ou, sans --doc-id/--pdf-id : création dans --folder-id

Options :
  --html PATH     HTML source (défaut docs/.guide-doc.html)
  --pdf  PATH     PDF source  (défaut docs/GUIDE_UTILISATEUR.pdf)
  --folder-id ID  dossier Drive cible (requis pour une création)
  --check-only    ne pousse rien, vérifie seulement les fichiers Drive actuels

Prérequis : google-api-python-client + PyMuPDF (venv GWS : /opt/data/.hermes/.venv-gws).
Le token OAuth est passé en argument (jamais par variable d'environnement : les valeurs
d'env sont caviardées dans les sorties d'outils).
"""
from __future__ import annotations

import argparse
import hashlib
import os
import sys
import tempfile
from pathlib import Path

from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload, MediaIoBaseDownload

GDOC = "application/vnd.google-apps.document"
SCOPES = ["https://www.googleapis.com/auth/drive"]


def svc(token: str):
    creds = Credentials.from_authorized_user_file(token, SCOPES)
    return build("drive", "v3", credentials=creds, cache_discovery=False)


def pdf_stats(path: str) -> tuple[int, int]:
    """(pages, images) d'un PDF, via PyMuPDF."""
    import fitz

    d = fitz.open(path)
    try:
        return d.page_count, sum(len(p.get_images(full=True)) for p in d)
    finally:
        d.close()


def md5(path: str) -> str:
    h = hashlib.md5()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def export_doc_pdf(service, file_id: str, dest: str) -> None:
    req = service.files().export_media(fileId=file_id, mimeType="application/pdf")
    with open(dest, "wb") as fh:
        dl = MediaIoBaseDownload(fh, req, chunksize=4 * 1024 * 1024)
        done = False
        while not done:
            _, done = dl.next_chunk()


def get_meta(service, file_id: str) -> dict:
    return (
        service.files()
        .get(fileId=file_id, fields="id,name,mimeType,size,modifiedTime,parents,webViewLink,trashed")
        .execute()
    )


def push_doc(service, html_path: str, doc_id: str | None, folder_id: str | None, name: str) -> str:
    """Google Doc : import HTML (les images base64 sont converties en images natives)."""
    media = MediaFileUpload(html_path, mimetype="text/html", resumable=True)
    if doc_id:
        out = (
            service.files()
            .update(
                fileId=doc_id,
                body={"mimeType": GDOC},
                media_body=media,
                fields="id,name,mimeType,modifiedTime,webViewLink",
            )
            .execute()
        )
    else:
        body = {"name": name, "mimeType": GDOC}
        if folder_id:
            body["parents"] = [folder_id]
        out = (
            service.files()
            .create(body=body, media_body=media, fields="id,name,mimeType,modifiedTime,webViewLink")
            .execute()
        )
    if out.get("mimeType") != GDOC:
        raise RuntimeError(f"conversion Google Doc échouée (mimeType={out.get('mimeType')})")
    return out["id"]


def push_pdf(service, pdf_path: str, pdf_id: str | None, folder_id: str | None, name: str) -> str:
    media = MediaFileUpload(pdf_path, mimetype="application/pdf", resumable=True)
    if pdf_id:
        out = (
            service.files()
            .update(
                fileId=pdf_id,
                media_body=media,
                fields="id,name,mimeType,modifiedTime,webViewLink,size",
            )
            .execute()
        )
    else:
        body = {"name": name, "mimeType": "application/pdf"}
        if folder_id:
            body["parents"] = [folder_id]
        out = (
            service.files()
            .create(body=body, media_body=media, fields="id,name,mimeType,modifiedTime,webViewLink,size")
            .execute()
        )
    return out["id"]


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--token", default="/opt/data/google_token.json")
    ap.add_argument("--html", default="docs/.guide-doc.html")
    ap.add_argument("--pdf", default="docs/GUIDE_UTILISATEUR.pdf")
    ap.add_argument("--folder-id")
    ap.add_argument("--doc-id")
    ap.add_argument("--pdf-id")
    ap.add_argument("--doc-name", default="TraqHACCP — Guide utilisateur (v4.0-registre)")
    ap.add_argument("--pdf-name", default="TraqHACCP — Guide utilisateur imprimable (v4.0-registre).pdf")
    ap.add_argument("--check-only", action="store_true")
    args = ap.parse_args()

    service = svc(args.token)
    fails: list[str] = []

    if args.check_only:
        for label, fid in (("Doc", args.doc_id), ("PDF", args.pdf_id)):
            if not fid:
                continue
            m = get_meta(service, fid)
            print(f"{label}: {m['name']} · {m.get('size', 'n/a')} o · {m['modifiedTime']} · {m['webViewLink']}")
            with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tf:
                tmp = tf.name
            try:
                export_doc_pdf(service, fid, tmp)
                pages, imgs = pdf_stats(tmp)
                print(f"  export PDF : {pages} pages · {imgs} images")
            finally:
                os.unlink(tmp)
        return 0

    html = Path(args.html)
    pdf = Path(args.pdf)
    if not html.exists():
        print(f"ERREUR : HTML introuvable ({html}) — lancer `node tools/build-guide-doc.mjs`.", file=sys.stderr)
        return 2
    if not pdf.exists():
        print(f"ERREUR : PDF introuvable ({pdf}) — lancer `npm run guide:pdf`.", file=sys.stderr)
        return 2
    if not (args.doc_id or args.folder_id):
        print("ERREUR : fournir --doc-id (mise à jour) ou --folder-id (création).", file=sys.stderr)
        return 2

    print(f"Source HTML : {html} ({html.stat().st_size / 1024:.0f} Ko)")
    print(f"Source PDF  : {pdf} ({pdf.stat().st_size / 1024 / 1024:.2f} Mo) · {md5(pdf)[:12]}")

    doc_id = push_doc(service, str(html), args.doc_id, args.folder_id, args.doc_name)
    print(f"Google Doc  : poussé -> {doc_id}")

    pdf_id = push_pdf(service, str(pdf), args.pdf_id, args.folder_id, args.pdf_name)
    print(f"PDF         : poussé -> {pdf_id}")

    # ---- Vérification : on relit ce qui est réellement stocké côté Drive ----
    print("\n--- VÉRIFICATION (état réel côté Drive) ---")
    m_doc = get_meta(service, doc_id)
    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tf:
        tmp = tf.name
    try:
        export_doc_pdf(service, doc_id, tmp)
        pages, imgs = pdf_stats(tmp)
    finally:
        os.unlink(tmp)
    print(f"Google Doc  : {m_doc['name']}")
    print(f"  modifié   : {m_doc['modifiedTime']}")
    print(f"  lien      : {m_doc['webViewLink']}")
    print(f"  export PDF: {pages} pages · {imgs} images")
    if imgs == 0:
        fails.append("Google Doc : aucune image (base64 non convertie par l'import)")

    m_pdf = get_meta(service, pdf_id)
    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tf:
        dl_path = tf.name
    try:
        req = service.files().get_media(fileId=pdf_id)
        with open(dl_path, "wb") as fh:
            dl = MediaIoBaseDownload(fh, req, chunksize=4 * 1024 * 1024)
            done = False
            while not done:
                _, done = dl.next_chunk()
        d_pages, d_imgs = pdf_stats(dl_path)
        same = md5(dl_path) == md5(str(pdf))
        print(f"PDF         : {m_pdf['name']}")
        print(f"  modifié   : {m_pdf['modifiedTime']}")
        print(f"  lien      : {m_pdf['webViewLink']}")
        print(f"  taille    : {m_pdf.get('size')} o côté Drive (local {pdf.stat().st_size} o)")
        print(f"  contenu   : {d_pages} pages · {d_imgs} images · md5 identique au local : {same}")
        if not same:
            fails.append("PDF : contenu Drive différent du fichier local")
        if d_imgs != 22:
            fails.append(f"PDF : {d_imgs} images (22 attendues)")
    finally:
        os.unlink(dl_path)

    if fails:
        print("\nÉCHEC :")
        for f in fails:
            print(f"  - {f}")
        return 1
    print("\nOK — Google Doc et PDF synchronisés et vérifiés.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
