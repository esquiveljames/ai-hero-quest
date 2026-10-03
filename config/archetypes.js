/* =====================================================================
   config/archetypes.js
   ---------------------------------------------------------------------
   The six Hero archetypes.

   Each archetype has:
     id            short code used inside the app
     name          what the visitor sees, e.g. "The Guardian"
     icon          an emoji shown at the reveal
     color         the hero's signature glow color
     lights        which Sigil lights blaze at the reveal:
                   "lumen" (book, Wisdom), "ember" (flame, Service),
                   "star" (star, Excellence)
     primaryVirtue the Honor Society virtue this hero stands for
     values        the three words shown under the hero
     meaning       one sentence the offline Oracle uses
     traitsPool    traits the offline fallback can pick from
     fallback      hand-written texts used when the AI is offline

   If you rename a hero, ALSO rename it in server/worker.js (HEROES).
   ===================================================================== */

window.HQ_ARCHETYPES = [
  {
    id: "sage",
    name: "The Sage",
    icon: "🧠",
    color: "#8FD3FF",
    lights: ["lumen"],
    primaryVirtue: "Scholarship",
    values: ["Scholarship", "Curiosity", "Insight"],
    meaning: "The Sage seeks understanding first, then lights the way for others.",
    traitsPool: ["Curiosity", "Insight", "Patience", "Clarity", "Wisdom"],
    fallback: {
      descriptions: [
        "You reach for understanding before you reach for the sword. In your hands, knowledge becomes a lantern for others.",
        "Your path bends toward questions worth asking. You learn deeply, and you learn so that others may follow.",
        "Where others rush, you read the stars first. Your wisdom is quiet, but it changes the course of the journey."
      ],
      prophecies: [
        "When the old map fails, the realm will turn to the one who studied the stars.",
        "A lantern lit by your learning will guide a traveler you have not yet met.",
        "The pages you master today will become the bridge someone crosses tomorrow."
      ],
      quests: [
        "This week, explain one hard concept to a classmate who is stuck on it.",
        "Share your best study method with someone preparing for an exam.",
        "Join a study session and be the one who asks the good questions."
      ]
    }
  },
  {
    id: "guardian",
    name: "The Guardian",
    icon: "🛡️",
    color: "#FF9A52",
    lights: ["ember"],
    primaryVirtue: "Service",
    values: ["Service", "Compassion", "Responsibility"],
    meaning: "The Guardian measures victory by how many others reach the finish line too.",
    traitsPool: ["Compassion", "Responsibility", "Kindness", "Loyalty", "Patience"],
    fallback: {
      descriptions: [
        "You measure a victory by how many others reach the finish line with you. Your strength is made for sharing.",
        "You notice who is falling behind, and you turn back for them. That is the rarest courage in any realm.",
        "Your shield is raised for others before yourself. Service is not a task for you; it is your nature."
      ],
      prophecies: [
        "A traveler you help today will one day hold the gate for a hundred more.",
        "Where your shield is raised, no scholar walks alone.",
        "The kindness you scatter on the road will grow into a forest of allies."
      ],
      quests: [
        "Make someone else's journey easier this week: offer help before they ask.",
        "Check on a classmate who has been quiet lately, and mean it.",
        "Spend one hour this month tutoring or mentoring a younger student."
      ]
    }
  },
  {
    id: "vanguard",
    name: "The Vanguard",
    icon: "⚔️",
    color: "#E9C46A",
    lights: ["star"],
    primaryVirtue: "Leadership",
    values: ["Leadership", "Courage", "Initiative"],
    meaning: "The Vanguard steps forward when others hesitate, and gives the fellowship its direction.",
    traitsPool: ["Courage", "Initiative", "Decisiveness", "Vision", "Resolve"],
    fallback: {
      descriptions: [
        "When the banner lies unclaimed, you are the one who lifts it. Others find their courage by following yours.",
        "You step forward when the path grows uncertain. Your leadership gives the fellowship its direction.",
        "You do not wait for a perfect moment to act. You make the moment, and you bring others with you."
      ],
      prophecies: [
        "When the horn sounds and no one moves, the realm will look to you.",
        "Your banner will rise at dawn, and a fellowship will gather beneath it.",
        "The first step you dare to take will become the road others travel."
      ],
      quests: [
        "Volunteer to lead one task this week that no one else wants.",
        "Give a teammate a real role, then help them succeed in it.",
        "Propose one small idea that would make your class or org better, and start it."
      ]
    }
  },
  {
    id: "paragon",
    name: "The Paragon",
    icon: "✨",
    color: "#F6DE92",
    lights: ["star"],
    primaryVirtue: "Excellence",
    values: ["Excellence", "Discipline", "Achievement"],
    meaning: "The Paragon pursues excellence, and by doing so raises the standard for everyone.",
    traitsPool: ["Discipline", "Precision", "Diligence", "Focus", "Mastery"],
    fallback: {
      descriptions: [
        "You do not settle for good enough. Your pursuit of excellence quietly raises the standard for everyone around you.",
        "Your craft is your quest. Every skill you sharpen becomes proof of what dedication can build.",
        "You hold yourself to a high mark, and you keep showing up to reach it. That is how legends are forged."
      ],
      prophecies: [
        "The blade you sharpen in silence will one day shine before the whole realm.",
        "Your discipline is a star others will steer by.",
        "What you master in the quiet hours will be remembered in the great hall."
      ],
      quests: [
        "Pick one skill and practice it deliberately for 20 minutes a day this week.",
        "Revisit your last project and improve one part until you are proud of it.",
        "Set one clear academic goal for this term and tell a friend who will check in."
      ]
    }
  },
  {
    id: "oathkeeper",
    name: "The Oathkeeper",
    icon: "🗝️",
    color: "#9FF0D2",
    lights: ["ember"],
    primaryVirtue: "Integrity",
    values: ["Integrity", "Honesty", "Character"],
    meaning: "The Oathkeeper does what is right even when no one is watching.",
    traitsPool: ["Honesty", "Integrity", "Fairness", "Steadfastness", "Trustworthiness"],
    fallback: {
      descriptions: [
        "You choose the right path even when no one is watching. Your word is a key that opens every door worth entering.",
        "Shortcuts do not tempt you for long. Your honesty is the foundation others build their trust upon.",
        "You carry your principles like a lantern through the fog. In you, the realm has someone it can trust."
      ],
      prophecies: [
        "In an age of whispered shortcuts, the realm will be saved by one who kept their oath.",
        "The truth you guard will become the key to a door no one else can open.",
        "Your name will be spoken whenever trust is needed most."
      ],
      quests: [
        "This week, choose the honest path in one moment where the easy one was tempting.",
        "Give credit to a teammate whose work made yours better.",
        "Help a friend take the honest route on an assignment, even if it is harder."
      ]
    }
  },
  {
    id: "hearthbuilder",
    name: "The Hearthbuilder",
    icon: "🌿",
    color: "#A9E89C",
    lights: ["lumen", "ember"],
    primaryVirtue: "Community",
    values: ["Community", "Collaboration", "Creativity"],
    meaning: "The Hearthbuilder turns individuals into a fellowship where everyone has a place at the fire.",
    traitsPool: ["Collaboration", "Creativity", "Warmth", "Unity", "Inclusiveness"],
    fallback: {
      descriptions: [
        "You turn strangers into a fellowship. Where you are, people build things they could never build alone.",
        "You see the strength hidden in every teammate, and you bring it together. Your hearth warms the whole camp.",
        "Your greatest work is made with others. You build communities where everyone has a place at the fire."
      ],
      prophecies: [
        "Around the fire you kindle, a great fellowship will gather.",
        "The bridge you build together will outlast every tower built alone.",
        "Many hands will find their purpose because you invited them in."
      ],
      quests: [
        "Invite someone new into your study group or project this week.",
        "Organize one small gathering where classmates can learn together.",
        "Thank three people whose teamwork helped you this term."
      ]
    }
  }
];
