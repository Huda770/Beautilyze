"""Ingredient-based product recommendations from RecLogic.csv and the SQLite catalogue."""

import re
import sqlite3
import unicodedata
from contextlib import closing
from pathlib import Path

import pandas as pd

BASE_DIR = Path(__file__).resolve().parent


def normalize_ingredient(value):
    """Compare ingredient labels without case, spacing or punctuation differences."""
    return " ".join(re.findall(r"[^\W_]+", unicodedata.normalize("NFKC", value).casefold()))


def contains_avoided_ingredient(ingredients, avoid):
    return any(
        f" {term} " in f" {normalize_ingredient(ingredient)} "
        for ingredient in ingredients for term in avoid
    )


CNN_TO_CSV_SKIN_TYPE = {
    "oily": "Oily",
    "dry": "Dry",
    "combination": "Combination",
    "normal": "Normal",
}

CNN_TO_PRODUCT_SKIN_TYPE = {
    "oily": "oily-skin",
    "dry": "dry-skin",
    "combination": "combination-skin",
}

AGE_GROUP_TO_DATASET = {
    '14-18': '14-18',
    '19-25': '19-24',
    '26-35': '25-36',
    '36-45': '37-45',
    '45+': '45+',
    'Under 18': '14-18',
    '18-24': '19-24',
    '25-34': '25-36',
    '35-44': '37-45',
    '45 and above': '45+',
    'Prefer not to say': None,
    '19-24': '19-24',
    '25-36': '25-36',
    '37-45': '37-45',
}


df = pd.read_csv(BASE_DIR / 'RecLogic.csv')


def get_ideal_ingredients(skin_type, concerns, age_group):
    """
    skin_type: string, e.g. 'Normal'
    concerns: list of strings, e.g. ['Acne', 'Dullness']
    age_group: string, e.g. '14-18'
    """
    dataset_age_group = AGE_GROUP_TO_DATASET.get(age_group, age_group)
    mask = (
        (df['Skin_Type'].str.lower() == skin_type.lower()) &
        (df['Concern'].str.lower().isin([c.lower() for c in concerns]))
    )
    if dataset_age_group:
        mask &= df['Age_Group'] == dataset_age_group

    ingredient_set = set()
    for ingredients_text in df.loc[mask, 'Ingredients']:
        for part in ingredients_text.split('+'):
            clean_name = ''.join(c for c in part if not c.isdigit() and c not in '%().').strip()
            if clean_name:
                ingredient_set.add(clean_name)
    return ingredient_set


def get_products(database_path=None):
    with closing(sqlite3.connect(database_path or BASE_DIR / 'skincare.db')) as conn:
        rows = conn.execute('SELECT name, category, skin_types, ingredients FROM products').fetchall()
    return [
        {
            "name": name,
            "category": category,
            "skin_types": skin_types.split(','),
            "ingredients": [item.strip() for item in (ingredients or "").split(",") if item.strip()],
        }
        for name, category, skin_types, ingredients in rows
    ]


def score_products(skin_type, ideal_ingredients, allergies=None, database_path=None):
    """
    Scores each product based on:
    - whether it matches the user's skin type
    - how many of its ingredients overlap with the ideal ingredients
    """
    avoid = {
        term for term in (normalize_ingredient(item) for item in (allergies or []) if isinstance(item, str))
        if term
    }
    product_skin_type = CNN_TO_PRODUCT_SKIN_TYPE.get(skin_type, skin_type).lower()
    scored = []

    for product in get_products(database_path):
        if avoid and (not product["ingredients"] or contains_avoided_ingredient(product["ingredients"], avoid)):
            continue
        if product_skin_type not in (s.lower() for s in product["skin_types"]):
            continue

        overlap = set(product["ingredients"]).intersection(ideal_ingredients)
        scored.append({
            "name": product["name"],
            "category": product["category"],
            "score": len(overlap),
            "matched_ingredients": list(overlap),
        })

    scored.sort(key=lambda x: x["score"], reverse=True)
    return scored


def build_routine(
    skin_type,
    concerns,
    age_group,
    selected_categories=None,
    allergies=None,
    preferred_categories=None,
):
    """Builds a simple routine: the top scoring product per category."""
    if concerns == ["General"]:
        ideal_ingredients = set()
    else:
        csv_skin_type = CNN_TO_CSV_SKIN_TYPE.get(skin_type, skin_type)
        ideal_ingredients = get_ideal_ingredients(csv_skin_type, concerns, age_group)

    routine = {}
    for product in score_products(skin_type, ideal_ingredients, allergies):
        category = product["category"]
        if selected_categories and category not in selected_categories:
            continue
        routine.setdefault(category, product)

    if preferred_categories:
        preference_order = {category: index for index, category in enumerate(preferred_categories)}
        routine = dict(sorted(
            routine.items(),
            key=lambda item: preference_order.get(item[0], len(preference_order)),
        ))
    return routine


def get_products_by_name(name):
    for product in get_products():
        if product["name"] == name:
            return product
    return {"ingredients": []}


if __name__ == '__main__':
    result = get_ideal_ingredients('Normal', ['Acne', 'Dullness'], '14-18')
    print("Ideal ingredients found:", result)

    routine = build_routine('oily', ['Acne'], '14-18')
    print("\nRecommended routine:")
    for category, product in routine.items():
        print(f"{category}: {product['name']} (score: {product['score']}, matched: {product['matched_ingredients']})")
