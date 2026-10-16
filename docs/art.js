/* Drawings: Alice, the wild rose plate, corner sprays, the wax seal, stop icons. */
var Art = (function () {
  "use strict";
  var STEM = 'fill="none" stroke="var(--sage-ink)" stroke-linecap="round"';

  var ICON = {
    question: '<path d="M8.6 9.2a3.5 3.5 0 1 1 5.3 3c-1.2.8-1.9 1.4-1.9 2.6"/><circle cx="12" cy="18.6" r="1.1" fill="currentColor" stroke="none"/>',
    read: '<path d="M3.8 6.6c2.8-1 5.4-.8 8.2.8 2.8-1.6 5.4-1.8 8.2-.8v11.5c-2.8-1-5.4-.8-8.2.8-2.8-1.6-5.4-1.8-8.2-.8z"/><path d="M12 7.4v11.5"/>',
    watch: '<path d="M9.2 7.2l8 4.8-8 4.8z" fill="currentColor"/>',
    person: '<circle cx="12" cy="8.4" r="3.4"/><path d="M5.4 19.2c.8-3.7 3.4-5.4 6.6-5.4s5.8 1.7 6.6 5.4"/>',
    idea: '<path d="M12 3.8l2.1 6.1 6.1 2.1-6.1 2.1L12 20.2l-2.1-6.1L3.8 12l6.1-2.1z" fill="currentColor"/>'
  };
  function icon(k, size) {
    return '<svg viewBox="0 0 24 24" width="' + size + '" height="' + size + '" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICON[k] || ICON.question) + "</svg>";
  }

  function flower(x, y, s) {
    var p = "";
    for (var i = 0; i < 5; i++) {
      var a = i * 72 * Math.PI / 180 - Math.PI / 2;
      p += '<circle cx="' + (x + Math.cos(a) * 3.1 * s).toFixed(1) + '" cy="' + (y + Math.sin(a) * 3.1 * s).toFixed(1) + '" r="' + (2.5 * s).toFixed(1) + '" fill="var(--blossom)" stroke="var(--thread)" stroke-width=".5"/>';
    }
    return p + '<circle cx="' + x + '" cy="' + y + '" r="' + (1.5 * s).toFixed(1) + '" fill="var(--gold)"/>';
  }
  /* leaf points along deg (0 = right, 90 = down, -90 = up) */
  function leaf(x, y, deg, s) {
    return '<g transform="translate(' + x + " " + y + ") rotate(" + deg + ") scale(" + s + ')"><path d="M0 0C5-6 12-6 18 0C12 6 5 6 0 0z" fill="var(--sage)" stroke="var(--sage-ink)" stroke-width=".8" stroke-linejoin="round"/>' +
      '<path d="M1 0H16M6 0l4-3M6 0l4 3M11 0l3-2.2M11 0l3 2.2" fill="none" stroke="var(--sage-ink)" stroke-width=".5" stroke-linecap="round"/></g>';
  }
  function rose(x, y, s) {
    var p = '<g transform="translate(' + x + " " + y + ") scale(" + s + ')">', i, a;
    for (i = 0; i < 5; i++) {
      a = i * 72;
      p += '<ellipse cx="0" cy="-6.2" rx="5" ry="6.2" transform="rotate(' + a + ')" fill="var(--paper)" stroke="var(--thread)" stroke-width=".8"/>' +
        '<ellipse cx="0" cy="-5" rx="3" ry="4.2" transform="rotate(' + a + ')" fill="var(--blossom)" opacity=".45"/>' +
        '<path d="M0-3.2V-9.4" transform="rotate(' + a + ')" stroke="var(--thread)" stroke-width=".4" opacity=".7"/>';
    }
    p += '<circle r="2.6" fill="var(--gold)"/>';
    for (i = 0; i < 8; i++) { a = i * 45 * Math.PI / 180; p += '<circle cx="' + (Math.cos(a) * 4).toFixed(1) + '" cy="' + (Math.sin(a) * 4).toFixed(1) + '" r=".6" fill="var(--gold)"/>'; }
    return p + "</g>";
  }
  function bud(x, y, deg, s) {
    return '<g transform="translate(' + x + " " + y + ") rotate(" + deg + ") scale(" + s + ')"><ellipse rx="3" ry="4.6" fill="var(--blossom)" stroke="var(--thread)" stroke-width=".7"/>' +
      '<path d="M-3 3Q-1 6 -1.5 10M3 3Q1 6 1.5 10M0 4V11" fill="none" stroke="var(--sage-ink)" stroke-width=".8" stroke-linecap="round"/></g>';
  }
  function hip(x, y, s) {
    return '<g transform="translate(' + x + " " + y + ") scale(" + s + ')"><ellipse rx="3.6" ry="4.6" fill="var(--hip)" stroke="var(--thread)" stroke-width=".7"/>' +
      '<path d="M-1.6 -4.2l1.6-2 1.6 2" fill="none" stroke="var(--sage-ink)" stroke-width=".7" stroke-linecap="round"/><ellipse cx="-1.2" cy="-1" rx=".9" ry="1.6" fill="#fff" opacity=".35"/></g>';
  }

  function mascot(label) {
    var ink = 'stroke="var(--rabbit-ink)"';
    return '<svg viewBox="0 0 120 100" role="img" aria-label="' + (label || "Alice, a white rabbit with a ribbon at her neck, peeking out of a burrow") + '">' +
      '<ellipse cx="60" cy="80" rx="45" ry="15" fill="var(--hole)"/>' +
      '<g class="ear-l"><ellipse cx="45" cy="25" rx="8.5" ry="22" transform="rotate(-9 45 25)" fill="var(--rabbit)" ' + ink + ' stroke-width="1.8"/>' +
      '<ellipse cx="45" cy="27" rx="3.6" ry="14" transform="rotate(-9 45 27)" fill="var(--blossom)" opacity=".8"/></g>' +
      '<g class="ear-r"><ellipse cx="75" cy="23" rx="8.5" ry="22" transform="rotate(11 75 23)" fill="var(--rabbit)" ' + ink + ' stroke-width="1.8"/>' +
      '<ellipse cx="75" cy="25" rx="3.6" ry="14" transform="rotate(11 75 25)" fill="var(--blossom)" opacity=".8"/></g>' +
      '<ellipse cx="60" cy="60" rx="26" ry="23" fill="var(--rabbit)" ' + ink + ' stroke-width="1.8"/>' +
      '<ellipse cx="46" cy="63" rx="4.5" ry="3.3" fill="var(--blossom)" opacity=".5"/><ellipse cx="74" cy="63" rx="4.5" ry="3.3" fill="var(--blossom)" opacity=".5"/>' +
      '<ellipse class="eye" cx="51" cy="56" rx="2.8" ry="3.4" fill="var(--rabbit-ink)"/><ellipse class="eye" cx="69" cy="56" rx="2.8" ry="3.4" fill="var(--rabbit-ink)"/>' +
      '<circle cx="52" cy="54.7" r=".95" fill="#fff"/><circle cx="70" cy="54.7" r=".95" fill="#fff"/>' +
      '<path d="M47.5 51.5q3.5-2.6 7 0M65.5 51.5q3.5-2.6 7 0" fill="none" ' + ink + ' stroke-width="1" stroke-linecap="round"/>' +
      '<path d="M56.5 62.3h7l-3.5 4z" fill="var(--blossom)" ' + ink + ' stroke-width=".8" stroke-linejoin="round"/>' +
      '<path d="M60 66.3v2M60 68.3q-3 2.4-5.5 0M60 68.3q3 2.4 5.5 0" fill="none" ' + ink + ' stroke-width="1.2" stroke-linecap="round"/>' +
      '<path d="M41 61h-9M42 65l-8 3M79 61h9M78 65l8 3" fill="none" ' + ink + ' stroke-width="1" stroke-linecap="round"/>' +
      '<path d="M11 80Q60 67 109 80A49 18 0 0 1 11 80Z" fill="var(--mound)" ' + ink + ' stroke-width="1.8" stroke-linejoin="round"/>' +
      leaf(20, 80, -150, .9) + leaf(100, 80, -30, .9) + leaf(30, 86, -165, .8) + leaf(90, 86, -15, .8) +
      flower(24, 77, .9) + flower(97, 76, .9) + flower(34, 83, .7) + flower(87, 83, .7) +
      '<path d="M60 74C52 65 46 70 48.5 77C53 79.5 58 77.5 60 74Z" fill="var(--ribbon)" ' + ink + ' stroke-width=".8" stroke-linejoin="round"/>' +
      '<path d="M60 74C68 65 74 70 71.5 77C67 79.5 62 77.5 60 74Z" fill="var(--ribbon)" ' + ink + ' stroke-width=".8" stroke-linejoin="round"/>' +
      '<circle cx="60" cy="74.4" r="2.5" fill="var(--ribbon)" ' + ink + ' stroke-width=".8"/><circle cx="60" cy="74.4" r="1" fill="var(--gold)"/>' +
      "</svg>";
  }

  function plateArt() {
    return '<svg viewBox="0 0 120 172" role="presentation">' +
      '<path d="M60 166C58 140 66 120 60 98C55 80 62 64 60 40" ' + STEM + ' stroke-width="1.8"/>' +
      '<path d="M58 92C72 90 88 80 96 62" ' + STEM + ' stroke-width="1.4"/>' +
      '<path d="M59 78C50 74 44 70 40 66" ' + STEM + ' stroke-width="1.2"/>' +
      '<path d="M60 150C50 154 42 160 40 164" ' + STEM + ' stroke-width="1.2"/>' +
      '<path d="M62 130C74 136 82 142 84 148" ' + STEM + ' stroke-width="1.2"/>' +
      '<path d="M61 144l5-3-2 6zM63 108l-5-3 1 6z" fill="var(--sage-ink)"/>' +
      leaf(59, 150, -40, 1.5) + leaf(60, 138, -140, 1.5) + leaf(63, 122, -45, 1.4) + leaf(62, 110, -135, 1.4) +
      leaf(58, 92, -42, 1.2) + leaf(58, 82, -140, 1.2) + leaf(61, 64, -45, 1.0) + leaf(60, 54, -135, 1.0) +
      leaf(70, 89, -75, 1.1) + leaf(78, 85, 8, 1.0) + leaf(86, 78, -85, .9) +
      hip(40, 168, 1) + hip(84, 152, 1) + bud(38, 61, -30, 1) +
      rose(60, 30, 1.7) + rose(98, 54, 1.25) +
      "</svg>";
  }
  function cornerArt() {
    return '<svg viewBox="0 0 170 170" role="presentation">' +
      '<path d="M170 2C144 12 126 32 110 56C98 74 86 90 66 102" ' + STEM + ' stroke-width="1.6"/>' +
      '<path d="M110 56C120 62 128 66 136 66" ' + STEM + ' stroke-width="1.2"/>' +
      '<path d="M134 24C138 36 146 44 152 46" ' + STEM + ' stroke-width="1.2"/>' +
      leaf(152, 11, 100, 1.1) + leaf(152, 11, 205, 1.1) + leaf(134, 24, 80, 1.1) + leaf(134, 24, 185, 1.1) +
      leaf(121, 42, 70, 1.1) + leaf(121, 42, 175, 1.1) + leaf(106, 63, 65, 1.0) + leaf(98, 77, 170, 1.0) + leaf(88, 90, 60, .9) +
      leaf(124, 64, 10, .9) + leaf(142, 36, 20, .8) +
      bud(154, 50, 150, .9) + flower(140, 66, 1.2) + rose(62, 106, 1.25) + flower(80, 62, 1.0) +
      "</svg>";
  }
  function dividerArt() {
    return '<svg viewBox="0 0 64 18">' + leaf(25, 9, 180, .85) + leaf(39, 9, 0, .85) + leaf(23, 9, 215, .6) + leaf(41, 9, -35, .6) + flower(32, 9, 1.4) + "</svg>";
  }
  function sealPath(r) {
    var pts = [], n = 120;
    for (var i = 0; i < n; i++) {
      var a = i / n * Math.PI * 2, rr = r + 1.9 * Math.cos(a * 13) + .8 * Math.cos(a * 5 + 1);
      pts.push((rr * Math.cos(a)).toFixed(1) + " " + (rr * Math.sin(a)).toFixed(1));
    }
    return "M" + pts.join("L") + "Z";
  }

  return { ICON: ICON, icon: icon, mascot: mascot, plateArt: plateArt, cornerArt: cornerArt, dividerArt: dividerArt, sealPath: sealPath };
})();
