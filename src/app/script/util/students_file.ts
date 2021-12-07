export const columnOrderWithName = [
    ['studentId', 'Numar Matricol'],
    ['doctoralThesisType', 'Tip Formular'],
    ['name', 'Nume'],

    ['thesisType', 'Tipul Formularului'],
    ['marriageName', 'Nume de Casatorie'],
    ['thesis', 'Teza de Doctorat'],
    ['coordinator', 'Coordonator'],
    ['scholarShip', 'Bursa'],
    ['completionDate', 'Data Completarii'],
    ['cnatdcuRank', 'Rank CNATDCU'],
    ['type_', 'Tip'],
    ['title', 'Titlu'],
    ['authors', 'Autori'],
    ['translatedAuthors', 'Autori Tradusi'],
    ['startPage', 'Pagina de Start'],
    ['endPage', 'Pagina de Sfarsit'],
    ['articleNumber', 'Numarul Articolului'],
    ['doi', 'DOI'],
    ['conferenceTitle', 'Titlul Conferintei'],
    ['hierarchyDomains', 'Domeniul de Ierarhizare'],
    ['internationalMagazine', 'Revista Internationala'],
    ['BDI', 'BDI'],
    ['bdiType', 'Tipul BDI'],
    ['nonBDI', 'Non BDI'],
    ['national', 'National'],
    ['international', 'International'],
    ['bdiDatabase', 'Baza de Date BDI'],
    ['cncsRecognition', 'Recunoastere CNCS'],
    ['quality', 'Calitate'],
    ['manifestationClassification', 'Denumirea Manifestarii Stiintifice'],
    ['manifestationType', 'Tipul Manifestarii'],
    ['magazineType', 'Tipul Revistei'],
    ['link', 'Link'],
    ['year', 'Anul'],
    ['volume', 'Volum'],
    ['number', 'Numar'],
    ['magazineName', 'Numele Revistei'],
    ['magazineISI', 'Revista ISI'],
    ['bookTitle', 'Titlul Cartii'],
    ['bookPages', 'Nr de Pagini a Cartii'],
    ['edition', 'Editia'],
    ['isbn', 'ISBN'],
    ['observations', 'Observatii'],
    ['chapterName', 'Numele Capitolului'],
    ['qualityStandard', 'Standard de Calitate'],
    ['country', 'Tara'],
    ['translatedChapters', 'Capitole Traduse'],
    ['manifestationName', 'Numele Manifestarii'],
    ['cbi', 'CBI'],
    ['patentNumber', 'Numarul Brevetului'],
    ['authority', 'Autoritate'],
    ['contactName', 'Nume de Contact'],
    ['projectCode', 'Cod Proiect'],
    ['financier', 'Finantator'],
    ['function', 'Functie'],
    ['sourceTitle', 'Sursa'],
    ['issue', 'Issue'],
    ['citations', 'Citari'],
    ['yearOfAward', 'Anul Acordarii Premiului'],
    ['awardName', 'Denumirea Premiului'],
    ['awardOrganization', 'Organizatia care a Acordat Premiul'],
    // ['yearOfActivity', ''],
    ['admissionYear', 'Anul Admiterii'],
    ['academyName', 'Numele Academiei'],
    ['memberType', 'Tip Membru'],
    ['committeeName', 'Denumire Comitet'],
    ['committeeYear', 'Anul Intrarii In Comitet'],
    ['place', 'Loc'],
    ['contact', 'Contact'],
    ['date', 'Data'],
    ['startDate', 'Data de Inceput'],
    ['endDate', 'Data de Sfarsit'],
    ['publicationDate', 'Data Publicarii'],
];

export const columnOrder: string[] = [];
for (const column of columnOrderWithName) {
    columnOrder.push(column[0]);
}

export const columnOrderMap = new Map();
for (let i in columnOrderWithName) {
    columnOrderMap.set(columnOrderWithName[i][0], i);
}

// TODO Second type of student document

// export const columnOrderWithNameSecond = [
//     ['studentId', 'Numar Matricol'],
//     ['doctoralThesisType', 'Tip Formular'],
//     ['name', 'Nume'],
//
// ];
//
// export const columnOrderSecond: string[] = [];
// for (const column of columnOrderWithNameSecond) {
//     columnOrderSecond.push(column[0]);
// }
//
// export const columnOrderMapSecond = new Map();
// for (let i in columnOrderWithNameSecond) {
//     columnOrderMapSecond.set(columnOrderWithNameSecond[i][0], i);
// }
