/* =====================================================================
   config/questions.js
   ---------------------------------------------------------------------
   The five quest scenes the visitor answers with one tap each.

   Each option has:
     id       a unique code. The AI server receives ONLY these codes.
              (server/worker.js translates them back into text, so
              keep the ids and text in both files in sync.)
     icon     an emoji shown on the rune button
     label    the button text (keep it short!)
     echo     a phrase the OFFLINE fallback uses in its reading,
              written to follow "You ...", e.g. "You stayed beside..."
     weights  points toward each virtue, used ONLY by the offline
              fallback. The online AI interprets the choices itself.

   Virtues used in weights:
     Scholarship, Service, Leadership, Excellence, Integrity, Community
   ===================================================================== */

window.HQ_QUESTIONS = [
  {
    id: "q1",
    title: "The eve of the deadline",
    text: "Your teammate is struggling the night before your group project is due.",
    options: [
      { id: "q1_help",  icon: "🛡️", label: "Stay and help them finish",
        echo: "stayed beside a struggling teammate",
        weights: { Service: 3, Community: 1 } },
      { id: "q1_teach", icon: "🧠", label: "Teach them how to solve it",
        echo: "chose to teach rather than simply rescue",
        weights: { Scholarship: 2, Service: 2 } },
      { id: "q1_lead",  icon: "⚔️", label: "Split the work and lead the push",
        echo: "took command as the deadline loomed",
        weights: { Leadership: 3, Excellence: 1 } },
      { id: "q1_rally", icon: "🤝", label: "Rally the whole team together",
        echo: "rallied your whole team as one",
        weights: { Community: 3, Leadership: 1 } }
    ]
  },
  {
    id: "q2",
    title: "The whispered scroll",
    text: "Someone posts last year's exam answers in your class group chat.",
    options: [
      { id: "q2_study", icon: "🗝️", label: "Leave it unopened and study",
        echo: "left the forbidden scroll unopened",
        weights: { Integrity: 4, Scholarship: 1 } },
      { id: "q2_ask",   icon: "📜", label: "Ask the professor if it's allowed",
        echo: "sought the truth from your professor",
        weights: { Integrity: 3, Scholarship: 1 } },
      { id: "q2_warn",  icon: "🛡️", label: "Warn friends it could cost them",
        echo: "protected your friends from a costly shortcut",
        weights: { Integrity: 2, Service: 2 } },
      { id: "q2_speak", icon: "📣", label: "Speak up in the chat",
        echo: "spoke up when others stayed silent",
        weights: { Integrity: 2, Leadership: 2 } }
    ]
  },
  {
    id: "q3",
    title: "The unclaimed banner",
    text: "Your org needs someone to lead an event that no one wants to run.",
    options: [
      { id: "q3_lead",   icon: "⚔️", label: "Volunteer to lead it",
        echo: "raised the unclaimed banner yourself",
        weights: { Leadership: 3 } },
      { id: "q3_polish", icon: "✨", label: "Make one part of it excellent",
        echo: "vowed to make your part shine",
        weights: { Excellence: 3 } },
      { id: "q3_colead", icon: "🌿", label: "Co-lead it with a friend",
        echo: "shared the burden of leadership",
        weights: { Community: 2, Leadership: 1 } },
      { id: "q3_study",  icon: "📖", label: "Study how others pulled it off",
        echo: "studied the paths of those before you",
        weights: { Scholarship: 3 } }
    ]
  },
  {
    id: "q4",
    title: "The free Saturday",
    text: "An open day lies before you. Where does your path lead?",
    options: [
      { id: "q4_learn",  icon: "📖", label: "Deep-dive a topic I love",
        echo: "spent a free day chasing knowledge",
        weights: { Scholarship: 3 } },
      { id: "q4_serve",  icon: "🛡️", label: "Join a community outreach",
        echo: "gave a free day to your community",
        weights: { Service: 3 } },
      { id: "q4_master", icon: "✨", label: "Master a new skill",
        echo: "spent a free day sharpening your craft",
        weights: { Excellence: 3 } },
      { id: "q4_build",  icon: "🌿", label: "Build a project with friends",
        echo: "spent a free day building with friends",
        weights: { Community: 3 } }
    ]
  },
  {
    id: "q5",
    title: "The final relic",
    text: "Choose one relic to carry on your journey.",
    options: [
      { id: "q5_tome",    icon: "📖", label: "The Ancient Tome",
        echo: "chose the Ancient Tome",        weights: { Scholarship: 2 } },
      { id: "q5_shield",  icon: "🛡️", label: "The Warden's Shield",
        echo: "chose the Warden's Shield",     weights: { Service: 2 } },
      { id: "q5_banner",  icon: "🚩", label: "The Banner of Dawn",
        echo: "chose the Banner of Dawn",      weights: { Leadership: 2 } },
      { id: "q5_blade",   icon: "🗡️", label: "The Star-Forged Blade",
        echo: "chose the Star-Forged Blade",   weights: { Excellence: 2 } },
      { id: "q5_key",     icon: "🗝️", label: "The Truthkeeper's Key",
        echo: "chose the Truthkeeper's Key",   weights: { Integrity: 2 } },
      { id: "q5_lantern", icon: "🏮", label: "The Hearth Lantern",
        echo: "chose the Hearth Lantern",      weights: { Community: 2 } }
    ]
  }
];
