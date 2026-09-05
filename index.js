const http = require('http');


const fullName = 'Клубович Михаил Сергеевич';   
const group = 'Группа 401';             
const journalNumber = 8;                    


function calculatePi(iterations) {
    let insideCircle = 0;
    for (let i = 0; i < iterations; i++) {
        const x = Math.random();
        const y = Math.random();
        if (x * x + y * y <= 1) {
            insideCircle++;
        }
    }
    return (insideCircle / iterations) * 4;
}


const piValue = calculatePi(10000000); 


const piRounded = piValue.toFixed(journalNumber); 

const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.write('<h1>Информация о студенте</h1>');
    res.write(`<p><strong>ФИО:</strong> ${fullName}</p>`);
    res.write(`<p><strong>Группа:</strong> ${group}</p>`);
    res.write(`<p><strong>Номер по журналу:</strong> ${journalNumber}</p>`);
    res.write(`<p><strong>Число Пи (${journalNumber} знаков):</strong> ${piRounded}</p>`);
    res.write(`<p><strong>Точное значение Пи:</strong> 3.141592653589793</p>`);
    res.end();
});

const PORT = 3000;
server.listen(PORT, () => {
    console.log(`Сервер запущен на http://localhost:${PORT}`);
    console.log(`ФИО: ${fullName}`);
    console.log(`Группа: ${group}`);
    console.log(`Номер по журналу: ${journalNumber}`);
    console.log(`Число Пи (${journalNumber} знаков): ${piRounded}`);
});