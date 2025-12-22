import { MIDI, MIDINote } from "./MIDI";
import MIDIRegion from "../../Models/Region/MIDIRegion";
import Track from "../../Models/Track/Track";

/**
 * Encodes a variable length quantity.
 */
function encodeVLQ(value: number): number[] {
    const bytes: number[] = [];
    let t = value;
    
    bytes.push(t & 0x7F);
    while ((t >>= 7)) {
        bytes.unshift((t & 0x7F) | 0x80);
    }
    return bytes;
}

/**
 * Writes a 32-bit unsigned integer to the array.
 */
function writeUint32(arr: number[], val: number) {
    arr.push((val >> 24) & 0xFF);
    arr.push((val >> 16) & 0xFF);
    arr.push((val >> 8) & 0xFF);
    arr.push(val & 0xFF);
}

/**
 * Writes a 16-bit unsigned integer to the array.
 */
function writeUint16(arr: number[], val: number) {
    arr.push((val >> 8) & 0xFF);
    arr.push(val & 0xFF);
}

/**
 * Writes a string to the array.
 */
function writeString(arr: number[], str: string) {
    for (let i = 0; i < str.length; i++) {
        arr.push(str.charCodeAt(i));
    }
}

interface MidiEvent {
    time: number; // Absolute time in ms
    type: 'noteOn' | 'noteOff';
    channel: number;
    note: number;
    velocity: number;
}

/**
 * Converts a list of Tracks to a Standard MIDI File (Type 1).
 * 
 * @param tracks The tracks to export.
 * @param masterTrack If true, merges all tracks into one (but still Type 1 with 1 track? Or Type 0? 
 *                    Actually user asked for Master Track export which combines all regions. 
 *                    Usually Master Track export means a Type 1 file with all tracks separate, OR a Mixdown.
 *                    The user said: "Master track MIDI file is to store information of MIDI regions extracted from ALL tracks... 
 *                    Audio regions are ignored."
 *                    And "If check boxes are put on each track... save MIDI events of THAT track".
 * 
 *                    Wait, if Master Track is checked in the UI, usually it implies a mixdown in Audio context.
 *                    For MIDI, "Master Track" usually means the Tempo map track (Track 0).
 *                    But the user description says "Master track MIDI file ... is to save information of MIDI regions extracted from all tracks".
 *                    This implies a single track containing all notes (Type 0) OR a Type 1 file containing all tracks.
 *                    "Store information of MIDI regions extracted from all tracks" -> sounds like merging everything into one sequence?
 *                    "Make sure delta times of MIDI info mesh well between tracks" -> Alignment.
 * 
 *                    Let's interpret "Master Track" export as exporting ALL tracks into the MIDI file (Type 1).
 *                    And "Individual Track" export as exporting ONLY that track (Type 0 or Type 1 with 1 track).
 *                    
 *                    Actually, the Export dialog allows selecting "Master Track" AND/OR specific tracks.
 *                    If "Master Track" is selected, does it mean "All Tracks"?
 *                    In Audio export, "Master Track" means the output of the Master Bus (Mixdown).
 *                    In MIDI, a "Mixdown" would be merging all notes to one track (Type 0).
 *                    
 *                    However, usually DAW MIDI export of "All Tracks" creates a Type 1 file with multiple tracks.
 *                    
 *                    Let's look at the user prompt again:
 *                    "Master track MIDI file is to store MIDI region info extracted from all tracks... 
 *                     delta times should mesh well between tracks."
 *                    
 *                    If I select "Track 1" and "Track 2" in the dialog, I get separate files in Audio mode.
 *                    The user says: "When 'Audio' or 'MIDI' is selected ... transition to screen where you can select Master Track or each track...
 *                    actually downloaded file differs...
 *                    Master track MIDI file stores info from all tracks...
 *                    If check boxes for each track... save MIDI events of that track."
 *                    
 *                    This implies:
 *                    - Checking "Master Track" -> Downloads ONE file containing ALL MIDI data (Merged? Or Multitrack?). 
 *                      Given "Master Track" usually implies a single entity, merging to Type 0 (single track) might be what's implied by "Master Track", 
 *                      representing the full song in one stream.
 *                      BUT, Type 1 is generally preferred.
 *                      Let's create a Type 1 file containing ALL tracks if Master Track is selected.
 *                      Wait, if I select Master Track AND Track 1, do I get 2 files? Yes, usually.
 *                      
 *                    So:
 *                    - Export "Master Track" (MIDI) -> One .mid file containing ALL tracks (Type 1).
 *                    - Export "Track X" (MIDI) -> One .mid file containing ONLY Track X.
 * 
 * @param ppq Pulses per quarter note (default 480 or 960)
 * @param bpm Tempo for calculating ticks from ms (default 120)
 */
export function exportToMidi(tracks: Track[], ppq: number = 480, bpm: number = 120): Uint8Array {
    const fileBytes: number[] = [];

    // Header Chunk
    writeString(fileBytes, 'MThd');
    writeUint32(fileBytes, 6); // Header length
    writeUint16(fileBytes, 1); // Format 1 (Multi-track)
    writeUint16(fileBytes, tracks.length + 1); // Number of tracks (Tempo map + tracks)
    writeUint16(fileBytes, ppq); // Division

    // 1 tick duration in ms = 60000 / (bpm * ppq)
    // We need to convert absolute ms to ticks.
    // ticks = ms * (bpm * ppq) / 60000
    const msToTicks = (ms: number) => Math.round(ms * (bpm * ppq) / 60000);

    // Track 0: Tempo Map / Meta
    // For now just basic tempo
    const track0Bytes: number[] = [];
    
    // Set Tempo
    // Microseconds per quarter note = 60000000 / bpm
    const mpqn = Math.round(60000000 / bpm);
    
    track0Bytes.push(0x00); // Delta time 0
    track0Bytes.push(0xFF, 0x51, 0x03); // Tempo Meta Event
    track0Bytes.push((mpqn >> 16) & 0xFF, (mpqn >> 8) & 0xFF, mpqn & 0xFF);

    // End of Track
    track0Bytes.push(0x00); // Delta time 0
    track0Bytes.push(0xFF, 0x2F, 0x00);

    writeString(fileBytes, 'MTrk');
    writeUint32(fileBytes, track0Bytes.length);
    fileBytes.push(...track0Bytes);

    // Track N
    for (const track of tracks) {
        const trackBytes: number[] = [];
        let lastTick = 0;
        
        // Collect all events
        const events: MidiEvent[] = [];
        
        for (const region of track.regions) {
            if (region instanceof MIDIRegion) {
                const regionStartMs = region.start;
                region.midi.forEachNote((note: MIDINote, start: number) => {
                    const absStartMs = regionStartMs + start;
                    const absEndMs = absStartMs + note.duration;
                    
                    events.push({
                        time: absStartMs,
                        type: 'noteOn',
                        channel: 0, // Force channel 0 or use note.channel? Internal MIDI uses channel.
                        note: note.note,
                        velocity: Math.round(note.velocity * 127)
                    });
                    
                    events.push({
                        time: absEndMs,
                        type: 'noteOff',
                        channel: 0,
                        note: note.note,
                        velocity: 0
                    });
                });
            }
        }

        // Sort events by time
        events.sort((a, b) => a.time - b.time);

        // Name Track
        const nameBytes = [];
        for (let i = 0; i < track.element.name.length; i++) nameBytes.push(track.element.name.charCodeAt(i));
        
        trackBytes.push(0x00); // Delta 0
        trackBytes.push(0xFF, 0x03); // Track Name
        trackBytes.push(...encodeVLQ(nameBytes.length));
        trackBytes.push(...nameBytes);

        // Write Events
        for (const event of events) {
            const currentTick = msToTicks(event.time);
            const deltaTicks = Math.max(0, currentTick - lastTick);
            lastTick = currentTick;

            trackBytes.push(...encodeVLQ(deltaTicks));

            if (event.type === 'noteOn') {
                trackBytes.push(0x90 | (event.channel & 0x0F));
                trackBytes.push(event.note & 0x7F);
                trackBytes.push(event.velocity & 0x7F);
            } else {
                trackBytes.push(0x80 | (event.channel & 0x0F));
                trackBytes.push(event.note & 0x7F);
                trackBytes.push(0);
            }
        }

        // End of Track
        trackBytes.push(0x00, 0xFF, 0x2F, 0x00);

        writeString(fileBytes, 'MTrk');
        writeUint32(fileBytes, trackBytes.length);
        fileBytes.push(...trackBytes);
    }

    return new Uint8Array(fileBytes);
}
