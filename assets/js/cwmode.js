"use strict";

document.addEventListener("DOMContentLoaded", () => {
  const modeSwitch = document.getElementById("mode-switch");

  if (!modeSwitch) {
    return;
  }

  const isCWTypePage = window.location.pathname.endsWith("cwtype.html");

  modeSwitch.checked = isCWTypePage;

  modeSwitch.addEventListener("change", () => {
    window.location.href = modeSwitch.checked ? "cwtype.html" : "index.html";
  });
});
