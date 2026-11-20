export const PERSONALITIES = {
  predator: { name: "The Predator", color: "#e5484d", glyph: "\u265E", tag: "Attacks the king, keeps the initiative",
    lines: { start: "I'll be coming for your king.", pCheck: "Check. Bold, but I'm not afraid.", pCap: "You took it. Let's see what that costs you.", aCheck: "Your king is under pressure.", aCap: "Taken. I like where this is going.", aLead: "I'm ahead. Time to press.", pLead: "You're ahead. That won't last." } },
  trickster: { name: "The Trickster", color: "#8e6bd8", glyph: "\u265D", tag: "Unusual ideas, messy positions",
    lines: { start: "Let's make this position complicated.", pCheck: "A check. How direct of you.", pCap: "Interesting choice.", aCheck: "Surprise.", aCap: "That was not in your plan, was it?", aLead: "Funny how that worked out.", pLead: "You're ahead. For now." } },
  gambler: { name: "The Gambler", color: "#d99a0b", glyph: "\u265F", tag: "Calculated risks and sacrifices",
    lines: { start: "Fortune favours the active.", pCheck: "You raised the stakes.", pCap: "Fair trade? We'll see.", aCheck: "All in on the attack.", aCap: "A small price for activity.", aLead: "The risk paid off.", pLead: "You're up. I'll have to roll the dice." } },
  shadow: { name: "The Shadow", color: "#1fa591", glyph: "\u265A", tag: "Patient, quiet pressure",
    lines: { start: "No rush. I have time.", pCheck: "Noted.", pCap: "A concession. I'll remember it.", aCheck: "Quietly, but firmly.", aCap: "Small gains add up.", aLead: "The pressure is working.", pLead: "You're ahead. I'll wait for my moment." } },
  chaos: { name: "The Chaos", color: "#d6459b", glyph: "\u265C", tag: "Unpredictable, still coherent",
    lines: { start: "I see a different plan.", pCheck: "Check? Everything changes now.", pCap: "Order restored. Briefly.", aCheck: "Did you expect that?", aCap: "Chaos takes what it wants.", aLead: "The board is tilting my way.", pLead: "You're ahead. Let's shake that." } },
};
export const DIFFICULTIES = [["easy", "Easy"], ["medium", "Medium"], ["hard", "Hard"], ["nightmare", "Nightmare"]];
export const TIMES = [["1+0", "1 min", 60, 0], ["3+2", "3+2", 180, 2], ["5+0", "5 min", 300, 0], ["10+0", "10 min", 600, 0], ["15+10", "15+10", 900, 10], ["none", "No limit", 0, 0]];
