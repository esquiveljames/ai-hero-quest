/* =====================================================================
   config/society.js
   ---------------------------------------------------------------------
   Official Honor Society information shown on screen and used by the
   offline Oracle. Source: CCS Honor Society Constitution and By-Laws,
   A.Y. 2026-2027.

   IMPORTANT: server/worker.js keeps its own copy of these facts
   (SOCIETY_FACTS) so the online AI is grounded on the server side.
   If you change a fact here, change it there too.
   ===================================================================== */

window.HQ_SOCIETY = {

  // Article I: Name
  name: "Angeles University Foundation College of Computer Studies Honor Society",
  shortName: "CCS Honor Society",
  school: "Angeles University Foundation, College of Computer Studies",
  academicYear: "A.Y. 2026–2027",

  // Article II: Purpose (lightly condensed for the screen)
  purpose: "To recognize the excellence of scholars, to serve as academic role models, and to aid every student in achieving exceptional academic proficiency.",

  // NOTE: The constitution does not list "core values" by name.
  // These booth themes were DERIVED from Article II (excellence, role
  // models, aiding every student). Please confirm them with the officers.
  values: ["Excellence", "Scholarship", "Service", "Integrity", "Leadership", "Community"],

  // Article III and By-Laws Article I: Membership
  membership: [
    "Every scholar of the AUF College of Computer Studies is automatically a member, including Barbara Yap-Angeles, Agustin P. Angeles, College Scholar, and University Scholar grantees.",
    "Membership is free. No fees are collected.",
    "Participation is voluntary. Each scholar chooses whether to take part.",
    "Membership is valid for the academic year in which the scholarship was granted."
  ],

  // Article IV (Peer Ambassadors) and Article VI (Meetings)
  // TODO: add your actual events for this year (tutorial series, outreach, etc.)
  activities: [
    "Peer-led activities and academic support sessions, facilitated by four Peer Ambassadors.",
    "Regular meetings scheduled around classes, guided by the society's Plan of Action."
  ],

  officers: {
    president: "Abigail D. Arnold",
    adviser: "Dr. James A. Esquivel"
  },

  // How visitors can reach you. Add a Facebook page or form link in "url"
  // and a QR code will appear automatically on the Honor Society screen.
  contact: {
    text: "Talk to any officer at this booth.",
    url: ""
  },

  // Call-to-action lines shown on the Honor Society screen.
  // Membership is scholarship-based, so we speak to two audiences.
  cta: {
    scholar: "Are you a CCS scholar? You are already one of us. Claim your place.",
    everyone: "Not a scholar yet? Our purpose is to help every student excel. Ask us how."
  },

  // What the Oracle says on its first screen.
  oracleGreeting: "Every scholar walks a different path. Let me discover yours.",

  // Closing message (the heart of the exhibit).
  closing: [
    "Every student has a unique path.",
    "Honor is not simply a title. It is how we use our knowledge, character, and abilities to help others."
  ],

  // Preset "Ask the Oracle" buttons.
  // "local" is the answer used when the online AI is unavailable.
  // Use {hero}, {values}, {meaning}, {quest} to insert the visitor's result.
  oraclePresets: [
    {
      id: "what",
      label: "What is the CCS Honor Society?",
      local: "Hear the words of its charter: the Honor Society exists to recognize the excellence of scholars, to stand as academic role models, and to help every student reach exceptional proficiency. Its heroes are scholars who lift others as they rise."
    },
    {
      id: "join",
      label: "Who can become a member?",
      local: "Every scholar of the College of Computer Studies is already a member: Barbara Yap-Angeles, Agustin P. Angeles, College Scholar, and University Scholar grantees alike. There is no fee, and each scholar freely chooses to take part. Ask the guardians of this booth to learn more."
    },
    {
      id: "hero",
      label: "What does my hero type mean?",
      local: "{hero} walks the path of {values}. {meaning}"
    },
    {
      id: "grow",
      label: "How do I begin my quest?",
      local: "Begin small, and begin this week. Your quest: {quest} Great heroes are not made in one battle, but in many quiet choices."
    }
  ],

  // The secret Easter egg message (tap the sigil's three lights in order:
  // book, flame, star). See README "Secret quest".
  secret: {
    title: "✨ Secret quest unlocked",
    text: "You found the three lights in their true order: wisdom first, then service, then excellence. That is the oldest secret of this realm. Knowledge becomes honor only when it is used to lift others.",
    hint: "Tell the guardians of this booth the secret words: “the three lights.”"
  }
};
