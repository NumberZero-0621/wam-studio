import { ArrayBufferReader } from "../../Utils/ArrayBufferReader";
import { MIDI, MIDIAccumulator, MIDINote } from "./MIDI";

export interface ImportedTrack {
    name: string;
    midi: MIDI;
}

/**
 * Parses a Standard MIDI File (SMF) buffer and returns individual tracks with names.
 */
export async function parseMidiFile(buffer: ArrayBuffer): Promise<ImportedTrack[]> {
    const reader = new ArrayBufferReader(buffer);
    const header = reader.readString(4);
    if (header !== "MThd") throw new Error("Invalid MIDI header");

    const headerLength = reader.readUint32();
    if (headerLength < 6) throw new Error("Invalid MIDI header length");

    const format = reader.readUint16();
    const trackCount = reader.readUint16();
    const division = reader.readUint16(); // Ticks per quarter note usually

    // Handle Division (Simplified for now, assuming PPQ)
    let ticksPerBeat = division;
    if ((division & 0x8000) !== 0) {
        // SMPTE - Not supported fully yet in this snippet, falling back to 480 or similar default if needed or just trusting value
        console.warn("SMPTE time division not fully supported in simple import.");
    }

    const importedTracks: ImportedTrack[] = [];

    // Skip remaining header bytes if any
    if (headerLength > 6) reader.readBytes(headerLength - 6);

    for (let i = 0; i < trackCount; i++) {
        const trackHeader = reader.readString(4);
        if (trackHeader !== "MTrk") throw new Error("Invalid Track header");

        const trackLength = reader.readUint32();
        const endPos = reader.pointer + trackLength;

        let currentTime = 0; // In ticks
        let trackName = `Track ${i + 1}`;
        const accumulator = new MIDIAccumulator();
        
        // Tempo map could be global or per track, but for now we just convert ticks to ms roughly
        // We'll use a fixed tempo for conversion for simplicity or try to detect it.
        // For a DAW import, ideally we keep ticks and map to project tempo, but internal MIDI format uses MS.
        // Let's assume 120 BPM for conversion if no tempo events found, or handle tempo changes.
        // Since internal MIDI structure is time-based (ms), we need to convert delta-time (ticks) to ms.
        
        // A simple approach: Convert ticks to ms using current tempo.
        let currentTempo = 500000; // Microseconds per quarter note (120 BPM)
        
        // Helper to convert ticks to ms
        const ticksToMs = (ticks: number) => {
            // duration in ms = (ticks / ticksPerBeat) * (microsecondsPerBeat / 1000)
            return (ticks / ticksPerBeat) * (currentTempo / 1000);
        };

        let absTimeMs = 0;

        let hasNotes = false;

        while (reader.pointer < endPos) {
            const deltaTime = reader.readVarUInt();
            currentTime += deltaTime;
            absTimeMs += ticksToMs(deltaTime);

            const statusByte = reader.readUint8();
            let eventType = statusByte;
            
            // Running Status
            if ((statusByte & 0x80) === 0) {
                eventType = reader.lastStatus || 0;
                reader.pointer--; // Back up one byte to re-read data
            } else {
                reader.lastStatus = statusByte;
            }

            // MIDI Events
            if ((eventType & 0xF0) !== 0xF0) {
                const channel = eventType & 0x0F;
                switch (eventType & 0xF0) {
                    case 0x80: // Note Off
                        {
                            const note = reader.readUint8();
                            const velocity = reader.readUint8();
                            accumulator.noteOff(note, channel, absTimeMs);
                        }
                        break;
                    case 0x90: // Note On
                        {
                            const note = reader.readUint8();
                            const velocity = reader.readUint8();
                            if (velocity === 0) {
                                accumulator.noteOff(note, channel, absTimeMs);
                            } else {
                                accumulator.noteOn(note, channel, velocity / 127, absTimeMs);
                                hasNotes = true;
                            }
                        }
                        break;
                    case 0xA0: // Poly Key Pressure
                    case 0xB0: // Control Change
                    case 0xE0: // Pitch Bend
                        reader.readUint8(); reader.readUint8();
                        break;
                    case 0xC0: // Program Change
                    case 0xD0: // Channel Pressure
                        reader.readUint8();
                        break;
                }
            }
            // Sysex or Meta
            else if (eventType === 0xF0 || eventType === 0xF7) {
                const len = reader.readVarUInt();
                reader.readBytes(len);
            }
            else if (eventType === 0xFF) {
                // Meta Event
                const metaType = reader.readUint8();
                const len = reader.readVarUInt();
                
                if (metaType === 0x03) { // Track Name
                    trackName = new TextDecoder().decode(reader.readBytes(len));
                }
                else if (metaType === 0x51) { // Set Tempo
                    // 3 bytes
                    const t1 = reader.readUint8();
                    const t2 = reader.readUint8();
                    const t3 = reader.readUint8();
                    currentTempo = (t1 << 16) | (t2 << 8) | t3;
                }
                else if (metaType === 0x2F) { // End of Track
                    // Finish
                    reader.readBytes(0); // consumed len 0
                }
                else {
                    reader.readBytes(len);
                }
            }
        }

        // Only add tracks that actually contain notes
        if (hasNotes) {
            importedTracks.push({
                name: trackName,
                midi: accumulator.build()
            });
        }
    }

    return importedTracks;
}
