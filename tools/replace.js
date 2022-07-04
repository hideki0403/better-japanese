const locJa = []

const locEn = []

const result = {}
for(let i = 0; i < locEn.length; i++) {
    result[locEn[i].replace('News : ', '')] = locJa[i]
}

console.log(JSON.stringify(result, null, '    '))