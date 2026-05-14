const crypto = require('crypto');

async function rewriteMessage(input = {}, options = {}) {
  const payload = normalizeInput(input);
  const key = process.env.OPENAI_API_KEY;

  if (!key) return localFallback(payload);

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      temperature: Number(process.env.OPENAI_TEMPERATURE || 0.45),
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt() },
        { role: 'user', content: JSON.stringify(payload) }
      ]
    })
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    console.error('OpenAI error:', response.status, errorText.slice(0, 500));
    return { ...localFallback(payload), gentle_note: 'AI API was unavailable, so this is a safe fallback rewrite.' };
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '{}';
  try {
    return cleanOutput(JSON.parse(extractJson(content)));
  } catch (error) {
    console.error('Bad JSON from model:', content.slice(0, 500));
    return localFallback(payload);
  }
}

function extractJson(text) {
  const raw = String(text || '').trim();
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) return fenced[1].trim();
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start >= 0 && end > start) return raw.slice(start, end + 1);
  return raw;
}

function normalizeInput(input = {}) {
  return {
    speaker_role: String(input.role || input.speaker_role || '').includes('parent') ? 'parent' : 'teen_young_adult',
    target_role: String(input.target || input.target_role || 'family member'),
    speaker_age_range: String(input.speakerAge || input.speaker_age_range || 'unknown'),
    target_age_range: String(input.targetAge || input.target_age_range || 'unknown'),
    topic: String(input.topic || 'conflict'),
    target_vibe: String(input.vibe || input.target_vibe || 'unknown'),
    desired_tone: String(input.tone || input.desired_tone || 'calm and respectful'),
    raw_message: String(input.message || input.raw_message || '').slice(0, 4000)
  };
}

function systemPrompt() {
  return `You are Between Us, a calm family communication assistant for English-speaking parents, teens, and young adults.
Your job is to help users say emotionally difficult things in a way that lowers defensiveness, preserves dignity, and increases the chance of being heard.
You are not a therapist, doctor, lawyer, emergency responder, or mediator. Do not diagnose people.
First classify safety as normal, sensitive, or crisis. Crisis includes self-harm, suicide, violence, abuse, threats, coercion, immediate danger, sexual exploitation, or runaway risk.
If crisis, do not simply rewrite; encourage immediate help from trusted adults, local emergency services, crisis hotlines, school counselor, doctor, or relevant authority, and give only a short safe sentence if appropriate.
Always preserve the user's core need, remove blame-heavy phrasing, use I-feel/I-need language, and keep it age-appropriate.
Do not treat Gen Z, Gen Alpha, or parents as one universal voice. Adapt to role, likely age, topic, channel, and emotional temperature.
Anti-cringe rule: never force slang like no cap, slay, periodt, rizz, fam, vibe check, etc. unless the user used that style first. Realistic teen language is usually shorter, direct, emotionally honest, and not overly polished.
Avoid therapist-speak and corporate language. Do not write things like “I respectfully request emotional validation” unless the user explicitly wants formal language.
For teens, prefer natural textable wording. For parents, prefer caring but direct wording that does not sound like a counselor script.
Use the age and vibe fields. If the speaker is 10–13, keep language simple and safe. If 14–18, keep it textable, direct, and not overly polished. If 19–25, use more mature boundaries. If the speaker is a parent, sound caring and direct, not like a therapist script.
If target_vibe is strict, include responsibility/trust-building language. If anxious or overprotective, validate concern before asking for change. If gets angry fast, make the opener softer and include a pause option. If shuts down, make the ask low-pressure and short.
Before answering, internally check: Would a real person in this role actually send/say this? Is it too formal? Too therapist-like? Trying too hard to sound young? Does it reduce defensiveness while preserving the need?
Return valid JSON only with these keys: safety_classification, better_version, text_message_version, in_person_version, why_this_works, what_not_to_say, if_they_react_badly, gentle_note.
why_this_works and what_not_to_say must be arrays of strings.`;
}

function cleanOutput(obj = {}) {
  return {
    safety_classification: obj.safety_classification || 'normal',
    better_version: obj.better_version || '',
    text_message_version: obj.text_message_version || '',
    in_person_version: obj.in_person_version || '',
    why_this_works: Array.isArray(obj.why_this_works) ? obj.why_this_works : [],
    what_not_to_say: Array.isArray(obj.what_not_to_say) ? obj.what_not_to_say : [],
    if_they_react_badly: obj.if_they_react_badly || '',
    gentle_note: obj.gentle_note || ''
  };
}

function localFallback(input = {}) {
  const p = normalizeInput(input);
  const raw = p.raw_message.trim() || 'I do not know how to say this without starting a fight.';
  const crisis = /(kill myself|suicide|hurt myself|beat me|abuse|abused|unsafe|threat|violence|rape|assault|run away)/i.test(raw);
  if (crisis) {
    return {
      safety_classification: 'crisis',
      better_version: 'This sounds serious and potentially unsafe. Please reach out to a trusted adult, local emergency service, school counselor, doctor, or crisis support line now. You do not have to handle this alone.',
      text_message_version: 'I need help with something serious and I don’t feel safe handling it alone. Can you help me right now?',
      in_person_version: 'I need to tell you something serious. I need support and I may need help from someone qualified.',
      why_this_works: ['It prioritizes safety over wording.', 'It asks for immediate support instead of trying to manage a dangerous situation alone.'],
      what_not_to_say: ['Do not threaten or escalate the situation.', 'Do not meet an unsafe person alone.', 'Do not keep immediate danger secret.'],
      if_they_react_badly: 'I understand this is hard to hear, but I need help and safety first.',
      gentle_note: 'If there is immediate danger, contact local emergency services now.'
    };
  }

  const isParent = p.speaker_role === 'parent';
  const topicPhrase = topicToPhrase(p.topic);
  const need = extractNeed(raw);

  if (isParent) {
    return {
      safety_classification: 'normal',
      better_version: `I’m not trying to control you. I care about you, and ${topicPhrase}. I want to understand your side and agree on something that feels respectful and safe for both of us. ${need}`,
      text_message_version: 'I care about you and I don’t want this to become a fight. Can we talk about this calmly and find something fair?',
      in_person_version: 'I want to say this calmly. My intention isn’t to control you — it’s to understand what you need and explain what I’m worried about. Can we both speak for a few minutes without interrupting?',
      why_this_works: ['It leads with care instead of control.', 'It invites a shared plan instead of demanding obedience.'],
      what_not_to_say: ['You are being dramatic.', 'Because I said so.', 'You always make bad choices.'],
      if_they_react_badly: 'I hear that this feels frustrating. I’m not trying to attack you. I want to understand what would feel more respectful.',
      gentle_note: keylessNote()
    };
  }

  return {
    safety_classification: 'normal',
    better_version: `I want to explain this without fighting. When this turns into blame or a lecture, I shut down. I need to feel heard first, and then I’m willing to talk about solutions. ${need}`,
    text_message_version: 'I’m not trying to be disrespectful. I just need you to hear me before giving advice. Can we talk calmly?',
    in_person_version: 'Can I explain something for a few minutes without being interrupted? I’m not trying to attack you. I want you to understand what this feels like from my side.',
    why_this_works: ['It replaces accusation with a clear emotional need.', 'It asks for a specific behavior: listening before advice.'],
    what_not_to_say: ['You never listen.', 'You do not understand anything.', 'Forget it, I will never tell you anything again.'],
    if_they_react_badly: 'I’m not trying to attack you. I’m trying to explain why I shut down. Can we pause and come back to this calmer?',
    gentle_note: keylessNote()
  };
}

function keylessNote() {
  return process.env.OPENAI_API_KEY ? '' : 'This is a local fallback rewrite. Add OPENAI_API_KEY for production AI responses.';
}

function topicToPhrase(topic) {
  const t = String(topic || '').toLowerCase();
  if (t.includes('phone') || t.includes('social')) return 'I’m worried about how phone and social media habits are affecting trust, focus, or safety';
  if (t.includes('school') || t.includes('future')) return 'I’m worried about school, future plans, and how to support you without adding pressure';
  if (t.includes('dating')) return 'I’m trying to talk about dating in a way that is honest, respectful, and safe';
  if (t.includes('money')) return 'I want us to talk about money clearly without shame or pressure';
  if (t.includes('friends')) return 'I want to understand your friendships without judging you too quickly';
  return 'I want us to talk about trust, boundaries, and what each of us needs';
}

function extractNeed(raw) {
  const text = String(raw || '').replace(/\s+/g, ' ').trim();
  if (text.length < 20) return '';
  return `What I’m trying to say is: “${text.slice(0, 180)}${text.length > 180 ? '…' : ''}” — but in a calmer way.`;
}

function hashIdentity(value = '') {
  const salt = process.env.RATE_LIMIT_SALT || process.env.SUPABASE_SERVICE_ROLE_KEY || 'between-us-dev';
  return crypto.createHash('sha256').update(`${salt}:${value}`).digest('hex');
}

module.exports = {
  rewriteMessage,
  normalizeInput,
  cleanOutput,
  localFallback,
  systemPrompt,
  hashIdentity
};
