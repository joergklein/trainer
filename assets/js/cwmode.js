"use strict";

document.addEventListener("DOMContentLoaded", () => {
  const modeSwitch = document.getElementById("mode-switch");

  if (!modeSwitch) {
    return;
  }

  const isCWTypePage =
    window.location.pathname.endsWith("/cwtype.html") ||
    window.location.pathname.endsWith("cwtype.html");

  modeSwitch.checked = isCWTypePage;

  modeSwitch.addEventListener("change", () => {
    if (modeSwitch.checked) {
      window.location.href = "cwtype.html";
    } else {
      window.location.href = "index.html";
    }
  });
});
