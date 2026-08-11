# Unhinged 8 Ball Project Instructions

This is a compact, personality-driven interactive toy. Its job is to feel polished, immediate, funny, slightly ominous, and unmistakably unhinged without becoming frustrating.

## Creative direction

- Preserve the existing dark, atmospheric visual personality.
- Humor should be dry, surprising, and concise.
- Keep the experience simple. The 8 Ball is the star.
- Do not add conventional app chrome, explanatory clutter, or generic corporate styling.
- "No wisdom. No guarantees. Just vibes." is the governing spirit.

## UX and mobile

- Mobile is a first-class experience.
- The main interaction should fit comfortably without unnecessary scrolling at ordinary phone browser zoom.
- Keep the ball, question input/controls, verdict, and retry flow easy to reach.
- Preserve comfortable touch targets and prevent overflow/clipping.
- Atmosphere and animation must not interfere with readability or responsiveness.
- Respect reduced-motion preferences when changing motion behavior.

## Code and scope

- `index.html` currently contains the entire project: markup, styling, data, and interaction logic.
- Inspect before changing.
- Prefer the smallest clean fix.
- Do not refactor the whole single-file site merely for architectural neatness unless explicitly requested.
- Do not change unrelated copy, animation, fog behavior, or mobile layout while fixing another issue.
- Keep agent work concise and token-efficient.

## Testing

For meaningful changes, verify the main interaction on small mobile, standard mobile, large mobile, and desktop. Check question entry, answer display, repeated use, animation, and any audio/fog behavior affected by the change.
