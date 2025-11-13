import json

# Leggi dati
with open('equipment_analysis.json', encoding='utf-8') as f:
    data = json.load(f)

# Statistiche
tipologie = [t for t in data['liste']['tipologie'] if t != 'TIPI']
marche = [m for m in data['liste']['marche'] if m != 'MARCHE']
righe = data['modelli']['righe']

print(f'Tipologie uniche: {len(set(tipologie))}')
print(f'Marche uniche: {len(set(marche))}')
print(f'Totale righe modelli: {len(righe)}')

print('\n=== TIPOLOGIE ===')
for t in sorted(set(tipologie)):
    count = sum(1 for r in righe if r[0] == t)
    print(f'  - {t}: {count} modelli')

print('\n=== MAPPATURA TIPOLOGIE Excel → Form DM329 ===')
mapping = {
    'Serbatoio aria verticale': 'Serbatoi',
    'Serbatoio aria orizzontale': 'Serbatoi',
    'Serbatoio disoleatore': 'Disoleatori',
    'Compressore': 'Compressori',
    'Compressore con essiccatore integrato': 'Compressori',
    'Compressore alta pressione - Booster': 'Compressori',
    'Essiccatore frigorifero': 'Essiccatori',
    'Scambiatore di calore': 'Scambiatori',
    'Filtro': 'Filtri',
    'Separatore di condense': 'Separatori',
    'Valvola di sicurezza': 'Valvole di sicurezza'
}

for excel_tipo, form_tipo in mapping.items():
    count = sum(1 for r in righe if r[0] == excel_tipo)
    print(f'  "{excel_tipo}" → {form_tipo} ({count} modelli)')

print('\n=== PRIME 15 MARCHE (ordinate alfabeticamente) ===')
for m in sorted(set(marche))[:15]:
    count = sum(1 for r in righe if r[1] == m)
    print(f'  - {m}: {count} modelli')
