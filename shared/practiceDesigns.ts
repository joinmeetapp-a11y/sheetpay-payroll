/** Stable saved IDs. Unknown/legacy profiles retain their original design. */
export const BOOKING_DESIGNS=[
 {id:'split',name:'Signature Split',description:'Brand story and services beside the appointment form.'},
 {id:'editorial',name:'Editorial',description:'Serif headlines, numbered services and a magazine-style masthead.'},
 {id:'spotlight',name:'Spotlight',description:'A full-width cover hero with an overlapping booking card.'},
 {id:'concierge',name:'Executive',description:'A branded side rail, service directory and structured appointment desk.'},
 {id:'minimal',name:'Quiet Minimal',description:'Centered identity, service pills and a focused single-column form.'},
 {id:'studio',name:'Studio Grid',description:'An asymmetric grid with a bold introduction and individual service tiles.'},
] as const;
export const WIDGET_DESIGNS=[
 {id:'classic',name:'Classic Chat',description:'A familiar branded chat window and rounded launcher.'},
 {id:'concierge',name:'Concierge',description:'A personal welcome card with a service directory.'},
 {id:'voice',name:'Voice Desk',description:'A centered voice-inspired welcome and prominent circular launcher.'},
 {id:'minimal',name:'Text Minimal',description:'A clean compact messenger with a restrained text launcher.'},
 {id:'cards',name:'Service Cards',description:'A visual grid of services above the conversation.'},
 {id:'compact',name:'Compact Dock',description:'A slim horizontal identity bar and a small square launcher.'},
] as const;
export function bookingDesign(id?:string){return BOOKING_DESIGNS.find(d=>d.id===id)||BOOKING_DESIGNS[0];}
export function widgetDesign(id?:string){return WIDGET_DESIGNS.find(d=>d.id===id)||WIDGET_DESIGNS[0];}
