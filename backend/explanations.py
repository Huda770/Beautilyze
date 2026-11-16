"""Plain-language explanations for Beautilyze's actual result labels."""


SKIN_TYPE_EXPLANATIONS = {
    'combination': 'Some areas of your face may feel oilier than others, while other areas may feel balanced or dry.',
    'dry': 'Your skin may produce less oil, so it can sometimes feel tight, rough, or flaky.',
    'oily': 'Your skin may produce more oil than other skin types, which can contribute to a shiny appearance and clogged pores.',
}

CONCERN_EXPLANATIONS = {
    'Acne': 'Acne can involve clogged pores, spots, or inflamed areas. A photo and a selected goal cannot confirm a medical diagnosis.',
    'Dark Circles': 'The area under the eyes may look darker. This can have many causes and may not be a skin condition.',
    'Dark Spots': 'Some areas may look darker than the surrounding skin. Many things can cause this appearance.',
    'Dullness': 'Your skin may look less bright or even than usual. Lighting, dryness, and other factors can affect how it appears.',
    'Hyperpigmentation': 'Some areas may have more visible pigment and look darker. A photo cannot determine the cause.',
    'Open Pores': 'Pores may be more visible in some areas. Their appearance varies naturally and can be affected by oil and lighting.',
    'Redness': 'Some areas may look red or flushed. A photo cannot identify why the redness is present.',
    'Sun Tan': 'Your skin may look darker after sun exposure. This does not show how much sun damage may be present.',
    'Whiteheads / Blackheads': 'These are small clogged pores that may look white or dark at the surface.',
    'Wrinkles': 'Fine lines or folds may be visible. Their appearance is normal and can be affected by expression and lighting.',
    'No Skin Concerns': 'You have not selected a particular skin goal. Recommendations will focus on a general routine.',
}


def explanations_for(skin_type: str, concerns: list[str]) -> dict:
    return {
        'skin_type': SKIN_TYPE_EXPLANATIONS.get(skin_type),
        'selected_concerns': {
            concern: CONCERN_EXPLANATIONS[concern]
            for concern in concerns
            if concern in CONCERN_EXPLANATIONS
        },
    }
