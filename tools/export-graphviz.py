import json
import re

def clean_id(s):
    return re.sub(r'[^a-zA-Z0-9_]', '_', str(s))

def export_dot():
    with open('graphify-out/graph.json', 'r', encoding='utf-8') as f:
        data = json.load(f)

    nodes = data.get('nodes', [])
    links = data.get('links', [])
    labels_map = {}
    try:
        with open('graphify-out/.graphify_labels.json', 'r', encoding='utf-8') as f:
            labels_map = json.load(f)
    except Exception:
        pass

    dot_lines = [
        'digraph TraqHACCPArchitecture {',
        '  rankdir=LR;',
        '  node [shape=box, style="rounded,filled", fillcolor="#f0f4f8", fontname="Helvetica", fontsize=10];',
        '  edge [color="#64748b", fontname="Helvetica", fontsize=8];',
        '  compound=true;',
        ''
    ]

    # Group nodes by community
    communities = {}
    for node in nodes:
        cid = node.get('community', 0)
        communities.setdefault(cid, []).append(node)

    for cid, cnodes in communities.items():
        comm_name = labels_map.get(str(cid), f'Community_{cid}')
        safe_comm_name = comm_name.replace('"', '\\"')
        dot_lines.append(f'  subgraph cluster_{cid} {{')
        dot_lines.append(f'    label="{safe_comm_name}";')
        dot_lines.append('    style="rounded,dashed";')
        dot_lines.append('    color="#94a3b8";')
        dot_lines.append('    fontcolor="#1e293b";')
        dot_lines.append('    bgcolor="#f8fafc";')
        
        for n in cnodes:
            nid = clean_id(n.get('id', ''))
            label = n.get('label', nid).replace('"', '\\"')
            dot_lines.append(f'    "{nid}" [label="{label}"];')
        dot_lines.append('  }\n')

    # Add edges
    for link in links:
        src = clean_id(link.get('source'))
        tgt = clean_id(link.get('target'))
        rel = link.get('relation', '')
        if rel:
            dot_lines.append(f'  "{src}" -> "{tgt}" [label="{rel}"];')
        else:
            dot_lines.append(f'  "{src}" -> "{tgt}";')

    dot_lines.append('}')

    with open('graphify-out/architecture.dot', 'w', encoding='utf-8') as f:
        f.write('\n'.join(dot_lines))

    print(f"Exported graphify-out/architecture.dot with {len(nodes)} nodes and {len(links)} edges.")

if __name__ == '__main__':
    export_dot()
