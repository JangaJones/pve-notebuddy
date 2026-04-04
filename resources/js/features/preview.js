export function createPreviewFeature({
  refs,
  buildNoteHtml,
  maxOutputLength,
}) {
  function updateLengthState(noteHtml) {
    const len = noteHtml.length;
    refs.charCountEl.textContent = `${len} / ${maxOutputLength}`;

    if (len > maxOutputLength) {
      refs.charWarningEl.textContent = `Too long by ${len - maxOutputLength} characters.`;
      refs.copyBtn.disabled = true;
    } else {
      refs.charWarningEl.textContent = "";
      refs.copyBtn.disabled = len === 0;
    }
  }

  function renderOutput() {
    refs.iconScaleValueEl.textContent = `${refs.iconScaleEl.value} px`;
    const noteHtml = buildNoteHtml();
    refs.outputEl.value = noteHtml;
    refs.previewCard.innerHTML = noteHtml;
    updateLengthState(noteHtml);
  }

  return {
    renderOutput,
  };
}
