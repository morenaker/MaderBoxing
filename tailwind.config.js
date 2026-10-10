/** @type {import('tailwindcss').Config} */
module.exports = {
    content: ['./*.html'],
    theme: {
        extend: {
            colors: {
                brand: {
                    light: '#87CEEB', // Sky Blue
                    dark: '#003459',  // Prussian Blue
                }
            },
            fontFamily: {
                sans: ['Inter', 'sans-serif'],
            }
        }
    }
}
