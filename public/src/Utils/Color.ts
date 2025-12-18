






/**



 * Gets a random color in string format.



 * @return {string} - The random color.



 * @private



 */



export function getRandomColor(): string {



    var letters = '0123456789ABCDEF';



    var color = '#';



    for (var i = 0; i < 6; i++) {



      color += letters[Math.floor(Math.random() * 16)];



    }



    return color;



}







/**



 * Lightens a hex color number by a given percentage.



 * @param color - The hex color number.



 * @param percent - The percentage to lighten (0 to 1).



 * @returns - The lightened hex color number.



 */



export function lightenColor(color: number, percent: number): number {



    const r = (color >> 16) & 0xFF;



    const g = (color >> 8) & 0xFF;



    const b = color & 0xFF;







    const newR = Math.min(255, Math.floor(r + (255 - r) * percent));



    const newG = Math.min(255, Math.floor(g + (255 - g) * percent));



    const newB = Math.min(255, Math.floor(b + (255 - b) * percent));







    return (newR << 16) | (newG << 8) | newB;



}


