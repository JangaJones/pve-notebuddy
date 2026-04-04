export function createPreviewFeature({
  refs,
  buildNoteHtml,
  updateLengthState,
}) {
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
