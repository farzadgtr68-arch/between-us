# Between Us — Generation & Tone System v0.1

## Core Principle

Do not treat “Gen Z”, “Gen Alpha”, or “parents” as one voice.
The product should adapt to:

- Role: parent / teen / young adult
- Age range
- Relationship: mom, dad, son, daughter
- Topic
- Emotional temperature
- Desired channel: text message vs in-person
- Family style: strict, anxious, warm, avoidant, conflict-heavy, etc.

## Anti-Cringe Rule

Never force slang.
Do not use “no cap”, “slay”, “periodt”, “rizz”, “fam”, “vibe check”, etc. unless the user used that style first.
Most real teens do not want an AI to sound like a brand pretending to be young.

Good teen language is usually:

- Shorter
- Direct
- Emotionally honest but not overly polished
- Less formal than adult language
- Not therapy-speak
- Not corporate

Bad teen language:

- “Dear mother, I respectfully request emotional validation…”
- “No cap mom, you’re killing my vibe…”
- Long paragraphs that no teen would actually send

## Voice Buckets

### 1. Younger teen / Gen Alpha-ish, age 10–13

Goal: simple, safe, not too emotionally complex.

Style:
- Short sentences
- Clear ask
- Low shame
- Avoid abstract words like “autonomy” or “emotional regulation”

Example:
Bad raw: “You’re always mad at me.”
Better: “I feel like I’m in trouble a lot, even when I’m trying. Can you tell me what you want me to do differently?”

### 2. Teen / Gen Z, age 14–18

Goal: sound like something they might actually text or say.

Style:
- Direct but not insulting
- Uses “I need”, “I feel”, “Can we…”
- Medium-short
- Avoid forced slang

Example:
Bad raw: “You never listen. You just lecture me.”
Better: “I’m not trying to be disrespectful. I just need you to hear me before giving advice. Can we talk without it turning into a lecture?”

### 3. Young adult, age 19–25

Goal: more mature boundaries, still natural.

Style:
- Clear boundary
- Less dependent tone
- Respectful but firm

Example:
Bad raw: “Stop treating me like a kid.”
Better: “I know you care about me, but I need you to treat me like an adult in this conversation. I’m open to hearing your concerns, but I need my choices to be respected too.”

### 4. Millennial parent, age 28–42

Goal: emotionally aware but not weak or over-explaining.

Style:
- Validates child’s feeling
- Names concern
- Offers collaboration

Example:
Bad raw: “You’re addicted to your phone.”
Better: “I’m not trying to attack you. I’m worried about how much your phone is affecting your sleep and mood. Can we look at it together and agree on something realistic?”

### 5. Gen X / older parent, age 43–60+

Goal: natural parent voice, not therapy jargon.

Style:
- Warmer than command/control
- Still direct
- Avoids sounding like a counselor script

Example:
Bad raw: “Because I said so.”
Better: “I know this feels unfair. My concern is your safety, not controlling you. Let’s talk about what would make this feel more reasonable for both of us.”

## Output Realism Checks

Before returning an answer, the model should ask internally:

1. Would a real person in this role actually send this?
2. Is it too formal?
3. Is it too therapist-like?
4. Is it trying too hard to sound young?
5. Does it reduce defensiveness?
6. Does it preserve the speaker’s real need?
7. Is the text version short enough to send?
8. Is the in-person version natural to say out loud?

## Product UX Implication

The form should eventually ask one optional question:

“What’s the vibe of the other person?”

Options:
- Gets angry fast
- Gets quiet / shuts down
- Overprotective
- Strict
- Anxious
- Warm but doesn’t understand
- I’m not sure

This is often more useful than only asking generation.
