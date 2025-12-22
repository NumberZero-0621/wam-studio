


/**
 * Class to read data from an ArrayBuffer, from the start to the end with a cursor.
 * The byte order is big-endian.
 */
export class ArrayBufferReader{

    public cursor=0
    public lastStatus: number | undefined;
    private byte_buffer
    private data_view

    constructor(buffer:ArrayBuffer){
        this.byte_buffer=new Uint8Array(buffer)
        this.data_view=new DataView(buffer)
    }

    get pointer() { return this.cursor; }
    set pointer(val: number) { this.cursor = val; }

    /**
     * Check if the cursor is at the end of the buffer.
     */
    get end(): boolean{
        return this.cursor>=this.byte_buffer.length
    }

    /**
     * Read one byte from the buffer and move the cursor.
     * @returns 
     */
    readByte(): number{
        this.cursor++
        return this.byte_buffer[this.cursor-1]
    }

    /**
     * Read one byte from the buffer and move the cursor.
     * @returns 
     */
    readUint8(): number{
        return this.data_view.getUint8(this.cursor++)
    }

    /**
     * Read a number of bytes from the buffer and move the cursor.
     * The returned value is a subarray of the buffer, so it's a view, not a copy.
     * @param length 
     * @returns 
     */
    readBytes(length:number): Uint8Array{
        this.cursor+=length
        return this.byte_buffer.subarray(this.cursor-length, this.cursor)
    }

    /**
     * Read a string from the buffer and move the cursor.
     * @param length 
     * @returns 
     */
    readString(length:number): string{
        return String.fromCharCode(...this.readBytes(length))
    }

    /**
     * Read a 32-bit signed integer from the buffer and move the cursor.
     * @returns 
     */
    readInt32(): number{
        this.cursor+=4
        return this.data_view.getInt32(this.cursor-4)
    }

    /**
     * Read a 32-bit unsigned integer from the buffer and move the cursor.
     * @returns 
     */
    readUint32(): number{
        this.cursor+=4
        return this.data_view.getUint32(this.cursor-4)
    }

    /**
     * Read a 16-bit signed integer from the buffer and move the cursor.
     * @returns 
     */
    readUint16(): number{
        this.cursor+=2
        return this.data_view.getUint16(this.cursor-2)
    }

    /**
     * Read a 16-bit unsigned integer from the buffer and move the cursor.
     * @returns 
     */
    readInt16(): number{
        this.cursor+=2
        return this.data_view.getInt16(this.cursor-2)
    }
    
    /**
     * Read a 24-bit unsigned integer from the buffer and move the cursor.
     */
    readUint24(): number{
        this.cursor+=3
        return this.data_view.getUint8(this.cursor-3)*0x10000+this.data_view.getUint16(this.cursor-2)
    }

    /**
     * Read a variable-length unsigned integer from the buffer and move the cursor.
     * The format is a sequence of bytes, where the most significant bit of each byte is a flag to indicate if there are more bytes.
     * This is the format used in the Standard MIDI File format.
     */
    readVarUInt(): number{
        let value = 0;
        while (true) {
            if (this.cursor >= this.byte_buffer.length) return value;
            const byte = this.byte_buffer[this.cursor++];
            value = (value << 7) | (byte & 0x7F);
            if ((byte & 0x80) === 0) {
                return value;
            }
        }
    }
    
}