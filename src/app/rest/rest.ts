import {TablesRepository} from "../database/repository/tables.repository";
import {XLSXWorkBookService, XLSXWorkSheetService} from "../service/xlsx.service";
import {AcademyMember, AwardAndNomination, Citation, DidacticActivity, EditorialMember, Information, ISIProceeding,
    OrganizedEvent, Patent, ResearchContract, ScientificArticleBDI, ScientificArticleISI, ScientificBook,
    ScientificCommunication, Translation, WithoutActivity
} from "../database/models";
import XLSX, {WorkBook, WorkSheet} from "xlsx";
import {UtilService} from "../service/util.service";
import {Request, Response} from "express";
import {Responses} from "../service/service.response";
import {UserService} from "../service/user.service";
import {UploadedFile} from "express-fileupload";
import {MailOptions, MailService} from "../service/mail.service";
import {MailResponse} from "./rest.responses";
import axios from "axios";
import html = Mocha.reporters.html;

export class RestService {
    private static getWorkSheet(rows: any[], headers: string[], headersMap: Map<string, string>, name: string): XLSXWorkSheetService {
        const serv = new XLSXWorkSheetService(headers, headersMap, name);

        for (const item of rows) {
            serv.insertRow(item);
        }

        return serv;
    }

    static async getFormsWorkBook(): Promise<XLSXWorkBookService> {
        const infoSheet = this.getWorkSheet(await TablesRepository.allInformation(), Information.col, Information.columnsMap, Information.sheetName);
        const scISISheet = this.getWorkSheet(await TablesRepository.allScientificArticlesISI(), ScientificArticleISI.col, ScientificArticleISI.columnsMap, ScientificArticleISI.sheetName);
        const ISIprSheet = this.getWorkSheet(await TablesRepository.allISIProceedings(), ISIProceeding.col, ISIProceeding.columnsMap, ISIProceeding.sheetName);
        const scBDISheet = this.getWorkSheet(await TablesRepository.allScientificArticlesBDI(), ScientificArticleBDI.col, ScientificArticleBDI.columnsMap, ScientificArticleBDI.sheetName);
        const scBookSheet = this.getWorkSheet(await TablesRepository.allScientificBooks(), ScientificBook.col, ScientificBook.columnsMap, ScientificBook.sheetName);
        const trSheet = this.getWorkSheet(await TablesRepository.allTranslations(), Translation.col, Translation.columnsMap, Translation.sheetName);
        const scCommSheet = this.getWorkSheet(await TablesRepository.allScientificCommunications(), ScientificCommunication.col, ScientificCommunication.columnsMap, ScientificCommunication.sheetName);
        const patSheet = this.getWorkSheet(await TablesRepository.allPatents(), Patent.col, Patent.columnsMap, Patent.sheetName);
        const resContrSheet = this.getWorkSheet(await TablesRepository.allResearchContracts(), ResearchContract.col, ResearchContract.columnsMap, ResearchContract.sheetName);
        const citSheet = this.getWorkSheet(await TablesRepository.allCitations(), Citation.col, Citation.columnsMap, Citation.sheetName);
        const awardsSheet = this.getWorkSheet(await TablesRepository.allAwardAndNominations(), AwardAndNomination.col, AwardAndNomination.columnsMap, AwardAndNomination.sheetName);
        const acMemSheet = this.getWorkSheet(await TablesRepository.allAcademyMembers(), AcademyMember.col, AcademyMember.columnsMap, AcademyMember.sheetName);
        const edMemSheet = this.getWorkSheet(await TablesRepository.allEditorialMember(), EditorialMember.col, EditorialMember.columnsMap, EditorialMember.sheetName);
        const orgEvSheet = this.getWorkSheet(await TablesRepository.allOrganizedEvents(), OrganizedEvent.col, OrganizedEvent.columnsMap, OrganizedEvent.sheetName);
        const withoutSheet = this.getWorkSheet(await TablesRepository.allWithoutActivities(), WithoutActivity.col, WithoutActivity.columnsMap, WithoutActivity.sheetName);
        const didActSheet = this.getWorkSheet(await TablesRepository.allDidacticActivities(), DidacticActivity.col, DidacticActivity.columnsMap, DidacticActivity.sheetName);

        const sheets: XLSXWorkSheetService[] = [
            infoSheet, scISISheet, ISIprSheet, scBDISheet, scBookSheet, trSheet, scCommSheet, patSheet,
            resContrSheet, citSheet, awardsSheet, acMemSheet, edMemSheet, orgEvSheet, withoutSheet, didActSheet,
        ];

        const sheetBook = new XLSXWorkBookService();
        sheetBook.appendSheets(sheets);

        return sheetBook;
    }

    static async getForms(req: Request<any>, res: Response<any>) {
        const XLSX = require('XLSX');

        const workBook: WorkBook = (await RestService.getFormsWorkBook()).getInstance();

        const date = new Date();
        const fileName = `data_${UtilService.stringDate(date)}.xlsx`;

        res.setHeader('Content-disposition', 'attachment; filename=' + fileName);
        res.setHeader('Content-type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

        const wbOut = XLSX.write(workBook, {bookType: 'xlsx', type: 'buffer'});
        res.send(new Buffer(wbOut));
    }

    /* Activate user with email */
    static async activateUser(req: Request<any>, res: Response<any>) {
        const key = req.query.key as string;

        if (!key) {
            res.end(JSON.stringify({message: Responses.MISSING_KEY}));
        }

        const userService = new UserService();
        const serviceResponse = await userService.activateUser(key);

        res.end(JSON.stringify({message:serviceResponse.message}));
    }

    static async sendOrganizationEmail(req: Request<any>, res: Response<any>) {
        if (req.files === undefined) {
            res.statusCode = 406; // Not Acceptable
            res.end('Provide the XLSX file');
            return;
        }

        const emailTemplate = req.body.email;
        const subject = req.body.subject;
        const from = req.body.from;

        if (emailTemplate === undefined || subject === undefined || from === undefined) {
            res.statusCode = 406; // Not Acceptable
            res.end('Provide all the information: from, subject, email template');
            return;
        }

        const excelBuffer = req.files.excel as UploadedFile;
        const workBook = XLSX.read(excelBuffer.data);
        const sheet = workBook.Sheets[workBook.SheetNames[0]];

        const rows: any[] = XLSX.utils.sheet_to_json(sheet);

        const emailKey = 'Email';

        const emailRowsMap: Map<string, any[]> = new Map();

        const headers = Object.keys(rows[0]);

        let totalMails: string[] = [];
        for (let row of rows) {
            const rowMap: Map<string, any> = new Map(Object.entries(row));
            const email = rowMap.get(emailKey);

            const emailRows = emailRowsMap.get(email);
            if (emailRows === undefined) {
                emailRowsMap.set(email, [row]);
                totalMails.push(email);
                continue;
            }

            emailRows.push(row);
        }

        let successfulSend: string[] = [];
        let unsuccessfulSend: string[] = [];

        for (const [email, rows] of emailRowsMap.entries()) {
            const sheet: WorkSheet = XLSX.utils.aoa_to_sheet([
                headers
            ]);

            XLSX.utils.sheet_add_aoa(sheet, rows.map(item => Object.values(item)), {origin: -1});

            const workBook: WorkBook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workBook, sheet);

            const buffer: Buffer = XLSX.write(workBook, {bookType: 'xlsx', type: 'buffer'});

            const dateStr = UtilService.stringDate(new Date());

            try {
                const response = await MailService.sendMail(new MailOptions(
                    from,
                    [email],
                    [],
                    [],
                    subject,
                    emailTemplate,
                    emailTemplate,
                    [{content: buffer, filename: `organizare_${dateStr}.xlsx`}]

                ));
                successfulSend.push(email);
            } catch (e) {
                console.log(`Mail Error: ${email}`);
                console.log(e);
                unsuccessfulSend.push(email);
            }
        }

        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.send(JSON.stringify(new MailResponse(totalMails, successfulSend, unsuccessfulSend)));
    }

    static async sendFAZ(req: Request<any>, res: Response<any>) {

        const response = await axios.get('https://profs.info.uaic.ro/~orar/participanti/orar_alboaie.html');
        const htmlPage = response.data;

        const tableLineRegEx = new RegExp(/<tr.*>(.|\n|\r|\u2028|\u2029)*?<\/tr>/g);
        const tableCellRegex = new RegExp(/<td.*?>((.|\n|\r|\u2028|\u2029)*?)<\/td>/g);
        const clearHtmlRegex = new RegExp(/<.*?>|\n|\r|\u2028|\u2029|&nbsp/g, 'g');

        const lines = htmlPage.match(tableLineRegEx);

        for (const line of lines) {
            const cols = line.match(tableCellRegex);

            if (cols !== null) {

                let s = '';
                for (const col of cols) {
                    const cellValue = UtilService.fullTrim(col.replace(clearHtmlRegex, ''));
                    s += `${cellValue}    `;
                }

                console.log(s);
            }
        }

        res.setHeader('Content-Type', 'application/json');
        res.end('Done');
    }
}