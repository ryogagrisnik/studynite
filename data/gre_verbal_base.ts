import type { GreVerbalQuestion } from '@/types/greVerbal';

export const GRE_VERBAL_BASE: GreVerbalQuestion[] = [
  // ---- TEXT COMPLETION ----
  { exam:'GRE', section:'Text Completion', format:'TC',
    stem:'Upon visiting the Middle East in 1850, Gustave Flaubert was so _____ belly dancing that he wrote in a letter to his mother that the dancers alone made his trip worthwhile.',
    choices:['overwhelmed by','enamored by','taken aback by','beseeched by','flustered by']
  },
  { exam:'GRE', section:'Text Completion', format:'TC',
    stem:'Increasingly, the boundaries of congressional seats are drawn to protect incumbents… so that those already in office can coast to (i) _____ victory. Once the primary is over, the general election is (ii) _____.',
    blanks:[ {options:['an ineluctable','an invidious','a plangent']},
             {options:['seldom nugatory','remarkably contentious','merely denouement']} ]
  },
  { exam:'GRE', section:'Text Completion', format:'TC',
    stem:'The travel writer’s _____ towards others he met on his cross-country trip most likely endeared him only to those readers with a misanthropic bent.',
    choices:['diffidence','humility','cynicism','garrulity','obsequiousness']
  },
  { exam:'GRE', section:'Text Completion', format:'TC',
    stem:'Unlike the performances of her youth, in which she seamlessly inhabited a role, the performances of her later years were _____, as though she were calling out to audiences, “look how convincingly I can portray my character.”',
    choices:['decrepit','comical','volatile','mechanical','contrived']
  },
  { exam:'GRE', section:'Text Completion', format:'TC',
    stem:'With characteristic _____, H.L. Mencken skewered the sacred cows of his time, criticizing social trends and government institutions with equal asperity.',
    choices:['hauteur','playfulness','vitriol','civility','dash']
  },
  { exam:'GRE', section:'Text Completion', format:'TC',
    stem:'An element of _____ on the part of the audience is interwoven into the multi-era saga…',
    choices:['surprise','foreboding','disbelief','confusion','predictability']
  },
  { exam:'GRE', section:'Text Completion', format:'TC',
    stem:'Were scientific advancement simply a question of the mere accumulation of facts then we have made (1) _____ progress…; however… accounts for the (2) _____ breakthroughs.',
    blanks:[ {options:['inimitable','scant','evident']},
             {options:['diligent','momentous','limited']} ]
  },
  { exam:'GRE', section:'Text Completion', format:'TC',
    stem:'In (i) _____ what they see as a culture so dominated by technology… the authors cast generalizations so wide that all but the hardiest Luddites will remain (ii) _____.',
    blanks:[ {options:['bemoaning','glorifying','overlooking']},
             {options:['committed','unconvinced','dispirited']} ]
  },
  { exam:'GRE', section:'Text Completion', format:'TC',
    stem:'The term “rocket scientist,” as used to denote somebody of great erudition, is (i) _____ given that the last few decades has seen a flowering of vocations just as worthy of (ii) _____, and far more topical.',
    blanks:[ {options:['inaccurate','appropriate','anachronistic']},
             {options:['this exalted term','identification with such individuals','interstellar ambitions']} ]
  },
  { exam:'GRE', section:'Text Completion', format:'TC',
    stem:'Unlike the expatriates of yester years, who gave nothing back to their native lands, those today are making _____ investments.',
    choices:['more or less the same','much smaller','truly commendable','mandatory','obligatory']
  },
  { exam:'GRE', section:'Text Completion', format:'TC',
    stem:'While alcohol causes obvious and immediate changes in moods and behaviours, nicotine has _____ effects, but is equally deleterious to health over prolonged periods of time.',
    choices:['more pronounced','less harmful','equal','less conspicuous','similar']
  },
  { exam:'GRE', section:'Text Completion', format:'TC',
    stem:'Greek tragedy, from which Racine borrowed _____, tended to assume that humanity was under the control of gods who were indifferent to its _____.',
    blanks:[ {options:['in plenitude','very rarely','only once']},
             {options:['sufferings and aspirations','followers and devotees','rites and rituals']} ]
  },
  { exam:'GRE', section:'Text Completion', format:'TC',
    stem:'In an effort to _____ the orbits of planets in class, the Professor created a motorized replica of the solar system.',
    choices:['confound','expound','exhort','corroborate','extenuate']
  },
  { exam:'GRE', section:'Text Completion', format:'TC',
    stem:'Nostalgia can distort the picture of reality by _____ events from one’s past and by _____ more recent events.',
    blanks:[ {options:['eliciting','edifying','exalting']},
             {options:['demoralizing','disparaging','ridiculing']} ]
  },
  { exam:'GRE', section:'Text Completion', format:'TC',
    stem:'Getting a private pilot’s license is expensive affair in Europe, but this problem can be _____ if one obtains a license from certain south-east Asian countries…',
    choices:['prevaricated','excluded','exacerbated','circumvented','averted']
  },
  { exam:'GRE', section:'Text Completion', format:'TC',
    stem:'Considering its high level of juvenile delinquency… it is surprising the small mid-western town also has one of the highest number of _____ youngsters in the country.',
    choices:['belligerent','peremptory','prolific','prodigal','precocious']
  },

  // ---- SENTENCE EQUIVALENCE ----
  { exam:'GRE', section:'Sentence Equivalence', format:'SE',
    stem:'Possessed of an insatiable sweet tooth, Jim enjoyed all kinds of candy, but he had a special _____ for gumdrops, his absolute favorite.',
    choices:['container','affinity','odium','nature','disregard','predilection']
  },
  { exam:'GRE', section:'Sentence Equivalence', format:'SE',
    stem:'The twins’ heredity and upbringing were identical… yet one child remained unfailingly sanguine while her sister… indicated an exceptionally choleric _____.',
    choices:['genotype','environment','physiognomy','incarnation','temperament','humor']
  },
  { exam:'GRE', section:'Sentence Equivalence', format:'SE',
    stem:'Water experts predict that unless the coming year’s rainfall is significantly above average, the city’s denizens will have to _____ their water usage.',
    choices:['curtail','intensify','administer','denote','disseminate','limit']
  },
  { exam:'GRE', section:'Sentence Equivalence', format:'SE',
    stem:'The heckler… is the epitome of _____—as soon as he has been identified, he goes scuttling off, head down, grumbling to himself.',
    choices:['stealthiness','outspokenness','shyness','aloofness','cravenness','spinelessness']
  },
  { exam:'GRE', section:'Sentence Equivalence', format:'SE',
    stem:'The travel writer must invite _____; few, if any, travelogues have ever been inspired by a languorous afternoon poolside.',
    choices:['travail','tribulations','excitement','scandal','tranquility','serenity']
  },

  // ---- READING COMPREHENSION (short only) ----
  { exam:'GRE', section:'Reading Comprehension', format:'RC',
    passage:'Called by some “the island that time forgot,” Madagascar… aye-aye… endangered; superstition + habitat loss threaten it.',
    stem:'Based on the passage, the intended audience would most likely be',
    choices:['visitors to a natural science museum','professors of evolutionary science','a third-grade science class','students of comparative religions','attendees at a world cultural symposium']
  },
  { exam:'GRE', section:'Reading Comprehension', format:'RC',
    passage:'Called by some “the island that time forgot,” Madagascar… aye-aye… endangered; superstition + habitat loss threaten it.',
    stem:'Which statements can be logically inferred? (Select ALL.)',
    choices:['Taxonomic classifications are not always absolute.','The traditional religion of Madagascar involves augury.','There are no longer enough resources on the main island to support the aye-aye population.']
  },
  { exam:'GRE', section:'Reading Comprehension', format:'RC',
    passage:'A linguist argues that because languages contain unique, untranslatable concepts, one could create a more thorough artificial language by including all those unique concepts.',
    stem:'The conclusion depends on which assumption?',
    choices:['Extinct languages do not offer fundamentally different concept words.','Many languages have overlapping words.','Hundreds of languages go extinct each year.','One person could learn all languages.','Breadth of concepts is the only measure of a language’s thoroughness.']
  },
  { exam:'GRE', section:'Reading Comprehension', format:'RC',
    passage:'Over 80% of a certain state’s land is farmland. Small farms are declining; a large-equipment manufacturer expects strong sales due to consolidation.',
    stem:'Which statement, if true, most justifies the optimistic expectation?',
    choices:['Land has consolidated into large industrial farms needing bigger equipment.','The new factory is near several rail lines.','Food imports into the state have increased.','The manufacturer offers more models than competitors.','Some crops receive subsidies and have strong markets.']
  }
];
