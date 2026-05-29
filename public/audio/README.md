# Audio tracks (Discos Movimiento)

Drop your electronic/house tracks here and list them in `src/core/config.ts → AUDIO.tracks`.

- Default expected file: `discos.mp3` (configurable).
- The first track in the list plays (looped) while the **Discos Movimiento** landmark
  is the active chapter, and the analyser drives the environment: the ground ripples to
  the bass and the dots pulse to the beat.
- Audio starts only after you click the **Sound** toggle (browsers require a user gesture).
- If no track is present, the ripples still animate gently (just non-reactive).

Formats: `.mp3` / `.ogg` / `.wav` — keep them reasonably small for fast loading.
