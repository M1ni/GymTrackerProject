// Draws a weight as the plates you load on a 20 kg barbell.
// Plate colours follow the usual competition colours.
const BAR = 20;
const PLATES = [25, 20, 15, 10, 5, 2.5, 1.25];

// Returns the plates for ONE side of the bar, heaviest first. Example: 60 kg -> [20]
export function platesPerSide(kg) {
  let left = (kg - BAR) / 2;
  const plates = [];
  for (const plate of PLATES) {
    while (left >= plate) {
      plates.push(plate);
      left = left - plate;
    }
  }
  return plates;
}

// Returns the HTML for a small barbell drawing of this weight.
export function drawBarbell(kg) {
  if (!kg || kg < BAR) {
    return '<div class="barbell is-empty" aria-hidden="true"><span class="shaft"></span></div>';
  }
  const plates = platesPerSide(kg);
  const side = plates.map((p) => `<span class="plate p${String(p).replace(".", "-")}"></span>`);
  const label = plates.length ? `${plates.join(" + ")} kg each side` : "Just the bar";
  return `<div class="barbell" role="img" aria-label="${label}">
    <span class="sleeve left">${[...side].reverse().join("")}</span>
    <span class="shaft"></span>
    <span class="sleeve">${side.join("")}</span>
  </div>`;
}

// Short text version, e.g. "20 + 5 each side".
export function platesText(kg) {
  if (!kg || kg < BAR) return "Less than the bar";
  const plates = platesPerSide(kg);
  return plates.length ? `${plates.join(" + ")} each side` : "Just the bar";
}

// Fills every element like <span data-barbell="60"></span> with a drawing.
export function drawAllBarbells() {
  document.querySelectorAll("[data-barbell]").forEach((el) => {
    el.innerHTML = drawBarbell(Number(el.dataset.barbell));
  });
}
