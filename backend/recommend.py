import pandas as pd

# Maps CNN's skin type labels to the CSV's skin type labels
CNN_TO_CSV_SKIN_TYPE = {
    "oily-skin": "Oily",
    "dry-skin": "Dry",
    "healthy": "Normal",
    "acne-prone-skin": "Oily"  # treat acne-prone as oily for CSV lookup purposes, since CSV doesn't have this category
}

# Load the ingredient recommendation dataset
df = pd.read_csv('RecLogic.csv')

def get_ideal_ingredients(skin_type, concerns, age_group):
    """
    skin_type: string, e.g. 'Normal'
    concerns: list of strings, e.g. ['Acne', 'Dullness']
    age_group: string, e.g. '14-18'
    """
    filtered = df[
        (df['Skin_Type'].str.lower() == skin_type.lower()) &
        (df['Age_Group'] == age_group) &
        (df['Concern'].str.lower().isin([c.lower() for c in concerns]))
    ]

    ingredient_set = set()
    for ingredients_text in filtered['Ingredients']:
        parts = ingredients_text.split('+')
        for part in parts:
            clean_name = ''.join([c for c in part if not c.isdigit() and c not in '%().']).strip()
            if clean_name:
                ingredient_set.add(clean_name)

    return ingredient_set

import sqlite3

def get_products():
    conn = sqlite3.connect('skincare.db')
    cursor = conn.cursor()
    cursor.execute('SELECT name, category, skin_types, ingredients FROM products')
    rows = cursor.fetchall()
    conn.close()

    products = []
    for row in rows:
        products.append({
            "name": row[0],
            "category": row[1],
            "skin_types": row[2].split(','),
            "ingredients": row[3].split(',')
        })
    return products

def score_products(skin_type, ideal_ingredients):
    """
    Scores each product based on:
    - whether it matches the user's skin type
    - how many of its ingredients overlap with the ideal ingredients
    """
    scored = []
    products = get_products()

    for product in products:
        # Skip products that don't suit this skin type at all
        if skin_type.lower() not in [s.lower() for s in product["skin_types"]]:
            continue

        # Count ingredient overlap
        product_ingredients = set(product["ingredients"])
        overlap = product_ingredients.intersection(ideal_ingredients)
        score = len(overlap)

        scored.append({
            "name": product["name"],
            "category": product["category"],
            "score": score,
            "matched_ingredients": list(overlap)
        })

    # Sort by score, highest first
    scored.sort(key=lambda x: x["score"], reverse=True)
    return scored


def build_routine(skin_type, concerns, age_group , selected_categories=None):
    """
    Builds a simple routine: top scoring product per category
    """
    if concerns == ["General"]:
        ideal_ingredients = set()
    else: 
        csv_skin_type = CNN_TO_CSV_SKIN_TYPE.get(skin_type, skin_type)
        ideal_ingredients = get_ideal_ingredients(csv_skin_type, concerns, age_group)
    
    
    scored_products = score_products(skin_type, ideal_ingredients)
    routine = {}
    for product in scored_products:
        category = product["category"]
        # Only keep the best product per category

        if selected_categories and category not in selected_categories:
            continue 

        if category not in routine:
            routine[category] = product

    return routine


if __name__ == '__main__':
    result = get_ideal_ingredients('Normal', ['Acne', 'Dullness'], '14-18')
    print("Ideal ingredients found:", result)

    routine = build_routine('oily-skin', ['Acne'], '14-18')
    print("\nRecommended routine:")
    for category, product in routine.items():
        print(f"{category}: {product['name']} (score: {product['score']}, matched: {product['matched_ingredients']})")
