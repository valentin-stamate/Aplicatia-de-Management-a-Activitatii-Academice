import {
    AcademyMember,
    AwardAndNomination,
    Citation,
    DidacticActivity,
    EditorialMember,
    ISIProceeding,
    OrganizedEvent,
    Patent,
    ResearchContract,
    ScientificArticleBDI,
    ScientificArticleISI,
    ScientificBook,
    ScientificCommunication,
    Translation,
    User,
    WithoutActivity
} from "../database/db.models";
import {
    AcademyMemberModel,
    AwardAndNominationModel,
    BaseInformationModel,
    CitationModel,
    DidacticActivityModel,
    EditorialMemberModel,
    ISIProceedingModel,
    OrganizedEventModel,
    PatentModel,
    ResearchContractModel,
    ScientificArticleBDIModel,
    ScientificArticleISIModel,
    ScientificBookModel,
    ScientificCommunicationModel,
    TranslationModel,
    UserKeyModel,
    UserModel,
    WithoutActivityModel
} from "../database/sequelize";
import {UploadedFile} from "express-fileupload";

import {UtilService} from "../service/util.service";
import {EmailDefaults, LoginMessage, MailService} from "../service/email.service";
import {ResponseError} from "./rest.middlewares";
import {JwtService} from "../service/jwt.service";
import {Op} from "@sequelize/core";
import {XLSXService,} from "../service/file/xlsx.service";
import JSZip from "jszip";
import {ResponseMessage, StatusCode} from "./rest.util";
import {FormsService} from "../service/forms.service";
import {DocxService} from "../service/file/docx.service";
import {EmailResult} from "../service/models";

/** The layer where the logic holds */
export class RestService {
    /************************************************************************************
     *                               Visitor only
     ***********************************************************************************/
    static async check(user: User): Promise<void> {
        const row = await UserModel.findOne({
            where: {
                id: user.id,
                identifier: user.identifier,
                email: user.email,
                admin: user.admin,
            }});

        if (row === null) {
            throw new ResponseError(ResponseMessage.USER_NOT_EXISTS, StatusCode.NOT_FOUND);
        }

        return;
    }

    static async signup(user: User): Promise<void> {
        if (!user.identifier || !user.email || !user.alternativeEmail) {
            throw new ResponseError(ResponseMessage.INCOMPLETE_FORM, StatusCode.BAD_REQUEST);
        }

        const options = {
            where: {
                [Op.or]: [
                    {identifier: user.identifier},
                    {email: user.email},
                    {alternativeEmail: user.alternativeEmail},
                ]
            }
        };

        const existingUser = await UserModel.findOne(options);

        if (existingUser !== null) {
            throw new ResponseError(ResponseMessage.DATA_TAKEN, StatusCode.BAD_REQUEST);
        }

        const row = await BaseInformationModel.findOne({
            where: {
                identifier: user.identifier
            }
        });

        if (row === null) {
            throw new ResponseError(ResponseMessage.USER_NOT_REGISTERED, StatusCode.NOT_ACCEPTABLE);
        }

        user = {...user, admin: false};
        await UserModel.build({...user}).save();

        return;
    }

    static async login(user: User): Promise<void> {
        if (!user.identifier || !user.email) {
            throw new ResponseError(ResponseMessage.INCOMPLETE_FORM, StatusCode.BAD_REQUEST);
        }

        const row = await UserModel.findOne({
            where: {
                identifier: user.identifier,
                email: user.email
            }
        });

        if (row === null) {
            throw new ResponseError(ResponseMessage.NO_USER_FOUND, StatusCode.NOT_FOUND);
        }

        const realUser = row.toJSON() as User;
        const key = UtilService.generateRandomString(16);

        let dbKey = await UserKeyModel.findOne({
            where: {
                identifier: realUser.identifier
            }
        });

        if (dbKey === null) {
            await UserKeyModel.create({identifier: realUser.identifier, key: key});
        } else {
            await (dbKey.set({key: key}).save());
        }

        await MailService.sendMail({
            from: EmailDefaults.FROM,
            to: [realUser.email].join(','),
            subject: `[Login] ${EmailDefaults.APP_NAME}`,
            html: LoginMessage.getHtml(key),
        });

        return;
    }

    static async authenticate(key: string): Promise<string> {
        const row = await UserKeyModel.findOne({
            where: {
                key: key
            }
        });

        if (row === null) {
            throw new ResponseError(ResponseMessage.INVALID_AUTH_KEY, StatusCode.NOT_FOUND);
        }

        const user = await UserModel.findOne({
            where: {
                identifier: row.toJSON().identifier
            }
        });

        if (user === null) {
            throw new ResponseError(ResponseMessage.SOMETHING_WRONG, StatusCode.EXPECTATION_FAILED);
        }

        await row.destroy();

        return JwtService.generateAccessToken(user.toJSON() as User);
    }

    /************************************************************************************
     *                               User only
     ***********************************************************************************/
    static async getInformation(user: User): Promise<any> {
        const infoRow = await BaseInformationModel.findOne({
            where: {
                identifier: user.identifier
            }
        });
        const userRow = await UserModel.findOne({
            where: {
                id: user.id
            }
        });

        if (userRow === null) {
            throw new ResponseError(ResponseMessage.NO_USER_FOUND);
        }

        let infoData = {};
        const userData = userRow.toJSON();

        if (infoRow !== null) {
            infoData = infoRow.toJSON();
        }

        return {
            userInformation: userData,
            baseInformation: infoData,
        };
    }

    static async getForms(user: User): Promise<any> {
        const scArticleISI = (await ScientificArticleISIModel.findAll({
            where: {owner: user.identifier},
            order: ['id'],
        })).map(item => item.toJSON());
        const isiProceedings = (await ISIProceedingModel.findAll({
            where: {owner: user.identifier},
            order: ['id'],
        })).map(item => item.toJSON());
        const scArticleBDI = (await ScientificArticleBDIModel.findAll({
            where: {owner: user.identifier},
            order: ['id'],
        })).map(item => item.toJSON());
        const scBook = (await ScientificBookModel.findAll({
            where: {owner: user.identifier},
            order: ['id'],
        })).map(item => item.toJSON());
        const translation = (await TranslationModel.findAll({
            where: {owner: user.identifier},
            order: ['id'],
        })).map(item => item.toJSON());
        const scCommunication = (await ScientificCommunicationModel.findAll({
            where: {owner: user.identifier},
            order: ['id'],
        })).map(item => item.toJSON());
        const patent = (await PatentModel.findAll({
            where: {owner: user.identifier},
            order: ['id'],
        })).map(item => item.toJSON());
        const researchContract = (await ResearchContractModel.findAll({
            where: {owner: user.identifier},
            order: ['id'],
        })).map(item => item.toJSON());
        const citation = (await CitationModel.findAll({
            where: {owner: user.identifier},
            order: ['id'],
        })).map(item => item.toJSON());
        const awardsNomination = (await AwardAndNominationModel.findAll({
            where: {owner: user.identifier},
            order: ['id'],
        })).map(item => item.toJSON());
        const academyMember = (await AcademyMemberModel.findAll({
            where: {owner: user.identifier},
            order: ['id'],
        })).map(item => item.toJSON());
        const editorialMember = (await EditorialMemberModel.findAll({
            where: {owner: user.identifier},
            order: ['id'],
        })).map(item => item.toJSON());
        const organizedEvent = (await OrganizedEventModel.findAll({
            where: {owner: user.identifier},
            order: ['id'],
        })).map(item => item.toJSON());
        const withoutActivity = (await WithoutActivityModel.findAll({
            where: {owner: user.identifier},
            order: ['id'],
        })).map(item => item.toJSON());
        const didacticActivity = (await DidacticActivityModel.findAll({
            where: {owner: user.identifier},
            order: ['id'],
        })).map(item => item.toJSON());
        return {
            scArticleISI,isiProceedings, scArticleBDI, scBook, translation, scCommunication,
            patent, researchContract, citation, awardsNomination, academyMember, editorialMember,
            organizedEvent, withoutActivity, didacticActivity,
        };
    }

    /** Articole științifice publicate în extenso în reviste cotate Web of Science cu factor de impact */
    static async getScientificArticleISI(user: User): Promise<any> {
        return (await ScientificArticleISIModel.findAll({
            where: {owner: user.identifier},
            order: ['id'],
        })).map(item => item.toJSON());
    }

    static async addScientificArticleISI(user: User, data: ScientificArticleISI): Promise<void> {
        if (!UtilService.checkFormFields(data)) {
            throw new ResponseError(ResponseMessage.FORM_FIELD_ERROR, StatusCode.BAD_REQUEST);
        }

        await ScientificArticleISIModel.create({
            ...data,
            owner: user.identifier
        });
        return;
    }

    static async updateScientificArticleISI(user: User, formId: number, data: ScientificArticleISI): Promise<void> {
        if (!UtilService.checkFormFields(data)) {
            throw new ResponseError(ResponseMessage.FORM_FIELD_ERROR, StatusCode.BAD_REQUEST);
        }

        const row = await ScientificArticleISIModel.findOne({
            where: {
                owner: user.identifier,
                id: formId,
            }
        });

        if (row === null) {
            throw new ResponseError(ResponseMessage.DATA_NOT_FOUND, StatusCode.NOT_FOUND);
        }

        await row.set({...data}).save();
        return;
    }

    static async deleteScientificArticleISI(user: User, id: number): Promise<void> {
        const row = await ScientificArticleISIModel.findOne({
            where: {
                owner: user.identifier,
                id: id,
            }
        });

        if (row === null) {
            throw new ResponseError(ResponseMessage.DATA_NOT_FOUND, StatusCode.NOT_FOUND);
        }

        await row.destroy();
        return;
    }

    /** ISI proceedings */
    static async getISIProceeding(user: User): Promise<any> {
        return (await ISIProceedingModel.findAll({
            where: {owner: user.identifier},
            order: ['id'],
        })).map(item => item.toJSON());
    }

    static async addISIProceeding(user: User, data: ISIProceeding): Promise<any> {
        if (!UtilService.checkFormFields(data)) {
            throw new ResponseError(ResponseMessage.FORM_FIELD_ERROR, StatusCode.BAD_REQUEST);
        }

        await ISIProceedingModel.create({
            ...data,
            owner: user.identifier
        });
        return;
    }

    static async updateISIProceeding(user: User, formId: number, data: ISIProceeding): Promise<void> {
        if (!UtilService.checkFormFields(data)) {
            throw new ResponseError(ResponseMessage.FORM_FIELD_ERROR, StatusCode.BAD_REQUEST);
        }

        const row = await ISIProceedingModel.findOne({
            where: {
                owner: user.identifier,
                id: formId,
            }
        });

        if (row === null) {
            throw new ResponseError(ResponseMessage.DATA_NOT_FOUND, StatusCode.NOT_FOUND);
        }

        await row.set({...data}).save();
        return;
    }

    static async deleteISIProceeding(user: User, id: number): Promise<void> {
        const row = await ISIProceedingModel.findOne({
            where: {
                owner: user.identifier,
                id: id,
            }
        });

        if (row === null) {
            throw new ResponseError(ResponseMessage.DATA_NOT_FOUND, StatusCode.NOT_FOUND);
        }

        await row.destroy();
        return;
    }

    /** Articole științifice publicate în extenso în reviste indexate BDI și reviste de specialitate neindexate */
    static async getScientificArticleBDI(user: User): Promise<any> {
        return (await ScientificArticleBDIModel.findAll({
            where: {owner: user.identifier},
            order: ['id'],
        })).map(item => item.toJSON());
    }

    static async addScientificArticleBDI(user: User, data: ScientificArticleBDI): Promise<any> {
        if (!UtilService.checkFormFields(data)) {
            throw new ResponseError(ResponseMessage.FORM_FIELD_ERROR, StatusCode.BAD_REQUEST);
        }

        await ScientificArticleBDIModel.create({
            ...data,
            owner: user.identifier
        });
        return;
    }

    static async updateScientificArticleBDI(user: User, formId: number, data: ScientificArticleBDI): Promise<void> {
        if (!UtilService.checkFormFields(data)) {
            throw new ResponseError(ResponseMessage.FORM_FIELD_ERROR, StatusCode.BAD_REQUEST);
        }

        const row = await ScientificArticleBDIModel.findOne({
            where: {
                owner: user.identifier,
                id: formId,
            }
        });

        if (row === null) {
            throw new ResponseError(ResponseMessage.DATA_NOT_FOUND, StatusCode.NOT_FOUND);
        }

        await row.set({...data}).save();
        return;
    }

    static async deleteScientificArticleBDI(user: User, id: number): Promise<void> {
        const row = await ScientificArticleBDIModel.findOne({
            where: {
                owner: user.identifier,
                id: id,
            }
        });

        if (row === null) {
            throw new ResponseError(ResponseMessage.DATA_NOT_FOUND, StatusCode.NOT_FOUND);
        }

        await row.destroy();
        return;
    }

    /** Cărți ştiinţifice sau capitole de cărți publicate în edituri */
    static async getScientificBook(user: User): Promise<any> {
        return (await ScientificBookModel.findAll({
            where: {owner: user.identifier},
            order: ['id'],
        })).map(item => item.toJSON());
    }

    static async addScientificBook(user: User, data: ScientificBook): Promise<any> {
        if (!UtilService.checkFormFields(data)) {
            throw new ResponseError(ResponseMessage.FORM_FIELD_ERROR, StatusCode.BAD_REQUEST);
        }

        await ScientificBookModel.create({
            ...data,
            owner: user.identifier
        });
        return;
    }

    static async updateScientificBook(user: User, formId: number, data: ScientificBook): Promise<void> {
        if (!UtilService.checkFormFields(data)) {
            throw new ResponseError(ResponseMessage.FORM_FIELD_ERROR, StatusCode.BAD_REQUEST);
        }

        const row = await ScientificBookModel.findOne({
            where: {
                owner: user.identifier,
                id: formId,
            }
        });

        if (row === null) {
            throw new ResponseError(ResponseMessage.DATA_NOT_FOUND, StatusCode.NOT_FOUND);
        }

        await row.set({...data}).save();
        return;
    }

    static async deleteScientificBook(user: User, id: number): Promise<void> {
        const row = await ScientificBookModel.findOne({
            where: {
                owner: user.identifier,
                id: id,
            }
        });

        if (row === null) {
            throw new ResponseError(ResponseMessage.DATA_NOT_FOUND, StatusCode.NOT_FOUND);
        }

        await row.destroy();
        return;
    }

    /** Traduceri */
    static async getTranslation(user: User): Promise<any> {
        return (await TranslationModel.findAll({
            where: {owner: user.identifier},
            order: ['id'],
        })).map(item => item.toJSON());
    }

    static async addTranslation(user: User, data: Translation): Promise<any> {
        if (!UtilService.checkFormFields(data)) {
            throw new ResponseError(ResponseMessage.FORM_FIELD_ERROR, StatusCode.BAD_REQUEST);
        }

        await TranslationModel.create({
            ...data,
            owner: user.identifier
        });
        return;
    }

    static async updateTranslation(user: User, formId: number, data: Translation): Promise<void> {
        if (!UtilService.checkFormFields(data)) {
            throw new ResponseError(ResponseMessage.FORM_FIELD_ERROR, StatusCode.BAD_REQUEST);
        }

        const row = await TranslationModel.findOne({
            where: {
                owner: user.identifier,
                id: formId,
            }
        });

        if (row === null) {
            throw new ResponseError(ResponseMessage.DATA_NOT_FOUND, StatusCode.NOT_FOUND);
        }

        await row.set({...data}).save();
        return;
    }

    static async deleteTranslation(user: User, id: number) {
        const row = await TranslationModel.findOne({
            where: {
                owner: user.identifier,
                id: id,
            }
        });

        if (row === null) {
            throw new ResponseError(ResponseMessage.DATA_NOT_FOUND, StatusCode.NOT_FOUND);
        }

        await row.destroy();
        return;
    }

    /** Comunicări în manifestări științifice */
    static async getScientificCommunication(user: User) {
        return (await ScientificCommunicationModel.findAll({
            where: {owner: user.identifier},
            order: ['id'],
        })).map(item => item.toJSON());
    }

    static async addScientificCommunication(user: User, data: ScientificCommunication): Promise<any> {
        if (!UtilService.checkFormFields(data)) {
            throw new ResponseError(ResponseMessage.FORM_FIELD_ERROR, StatusCode.BAD_REQUEST);
        }

        await ScientificCommunicationModel.create({
            ...data,
            owner: user.identifier
        });
        return;
    }

    static async updateScientificCommunication(user: User, formId: number, data: ScientificCommunication) {
        if (!UtilService.checkFormFields(data)) {
            throw new ResponseError(ResponseMessage.FORM_FIELD_ERROR, StatusCode.BAD_REQUEST);
        }

        const row = await ScientificCommunicationModel.findOne({
            where: {
                owner: user.identifier,
                id: formId,
            }
        });

        if (row === null) {
            throw new ResponseError(ResponseMessage.DATA_NOT_FOUND, StatusCode.NOT_FOUND);
        }

        await row.set({...data}).save();
        return;
    }

    static async deleteScientificCommunication(user: User, id: number) {
        const row = await ScientificCommunicationModel.findOne({
            where: {
                owner: user.identifier,
                id: id,
            }
        });

        if (row === null) {
            throw new ResponseError(ResponseMessage.DATA_NOT_FOUND, StatusCode.NOT_FOUND);
        }

        await row.destroy();
        return;
    }

    /** Brevete */
    static async getPatent(user: User) {
        return (await PatentModel.findAll({
            where: {owner: user.identifier},
            order: ['id'],
        })).map(item => item.toJSON());
    }

    static async addPatent(user: User, data: Patent): Promise<any> {
        if (!UtilService.checkFormFields(data)) {
            throw new ResponseError(ResponseMessage.FORM_FIELD_ERROR, StatusCode.BAD_REQUEST);
        }

        await PatentModel.create({
            ...data,
            owner: user.identifier
        });
        return;
    }

    static async updatePatent(user: User, formId: number, data: Patent) {
        if (!UtilService.checkFormFields(data)) {
            throw new ResponseError(ResponseMessage.FORM_FIELD_ERROR, StatusCode.BAD_REQUEST);
        }

        const row = await PatentModel.findOne({
            where: {
                owner: user.identifier,
                id: formId,
            }
        });

        if (row === null) {
            throw new ResponseError(ResponseMessage.DATA_NOT_FOUND, StatusCode.NOT_FOUND);
        }

        await row.set({...data}).save();
        return;
    }

    static async deletePatent(user: User, id: number) {
        const row = await PatentModel.findOne({
            where: {
                owner: user.identifier,
                id: id,
            }
        });

        if (row === null) {
            throw new ResponseError(ResponseMessage.DATA_NOT_FOUND, StatusCode.NOT_FOUND);
        }

        await row.destroy();
        return;
    }

    /** Contracte de cercetare */
    static async getResearchContract(user: User) {
        return (await ResearchContractModel.findAll({
            where: {owner: user.identifier},
            order: ['id'],
        })).map(item => item.toJSON());
    }

    static async addResearchContract(user: User, data: ResearchContract): Promise<any> {
        if (!UtilService.checkFormFields(data)) {
            throw new ResponseError(ResponseMessage.FORM_FIELD_ERROR, StatusCode.BAD_REQUEST);
        }

        await ResearchContractModel.create({
            ...data,
            owner: user.identifier
        });
        return;
    }

    static async updateResearchContract(user: User, formId: number, data: ResearchContract) {
        if (!UtilService.checkFormFields(data)) {
            throw new ResponseError(ResponseMessage.FORM_FIELD_ERROR, StatusCode.BAD_REQUEST);
        }

        const row = await ResearchContractModel.findOne({
            where: {
                owner: user.identifier,
                id: formId,
            }
        });

        if (row === null) {
            throw new ResponseError(ResponseMessage.DATA_NOT_FOUND, StatusCode.NOT_FOUND);
        }

        await row.set({...data}).save();
        return;
    }

    static async deleteResearchContract(user: User, id: number) {
        const row = await ResearchContractModel.findOne({
            where: {
                owner: user.identifier,
                id: id,
            }
        });

        if (row === null) {
            throw new ResponseError(ResponseMessage.DATA_NOT_FOUND, StatusCode.NOT_FOUND);
        }

        await row.destroy();
        return;
    }

    /** Citări */
    static async getCitation(user: User) {
        return (await CitationModel.findAll({
            where: {owner: user.identifier},
            order: ['id'],
        })).map(item => item.toJSON());
    }

    static async addCitation(user: User, data: Citation): Promise<any> {
        if (!UtilService.checkFormFields(data)) {
            throw new ResponseError(ResponseMessage.FORM_FIELD_ERROR, StatusCode.BAD_REQUEST);
        }

        await CitationModel.create({
            ...data,
            owner: user.identifier
        });
        return;
    }

    static async updateCitation(user: User, formId: number, data: Citation) {
        if (!UtilService.checkFormFields(data)) {
            throw new ResponseError(ResponseMessage.FORM_FIELD_ERROR, StatusCode.BAD_REQUEST);
        }

        const row = await CitationModel.findOne({
            where: {
                owner: user.identifier,
                id: formId,
            }
        });

        if (row === null) {
            throw new ResponseError(ResponseMessage.DATA_NOT_FOUND, StatusCode.NOT_FOUND);
        }

        await row.set({...data}).save();
        return;
    }

    static async deleteCitation(user: User, id: number) {
        const row = await CitationModel.findOne({
            where: {
                owner: user.identifier,
                id: id,
            }
        });

        if (row === null) {
            throw new ResponseError(ResponseMessage.DATA_NOT_FOUND, StatusCode.NOT_FOUND);
        }

        await row.destroy();
        return;
    }

    /** Premii si nominalizări */
    static async getAwardAndNomination(user: User) {
        return (await AwardAndNominationModel.findAll({
            where: {owner: user.identifier},
            order: ['id'],
        })).map(item => item.toJSON());
    }

    static async addAwardAndNomination(user: User, data: AwardAndNomination): Promise<any> {
        if (!UtilService.checkFormFields(data)) {
            throw new ResponseError(ResponseMessage.FORM_FIELD_ERROR, StatusCode.BAD_REQUEST);
        }

        await AwardAndNominationModel.create({
            ...data,
            owner: user.identifier
        });
        return;
    }

    static async updateAwardAndNomination(user: User, formId: number, data: AwardAndNomination) {
        if (!UtilService.checkFormFields(data)) {
            throw new ResponseError(ResponseMessage.FORM_FIELD_ERROR, StatusCode.BAD_REQUEST);
        }

        const row = await AwardAndNominationModel.findOne({
            where: {
                owner: user.identifier,
                id: formId,
            }
        });

        if (row === null) {
            throw new ResponseError(ResponseMessage.DATA_NOT_FOUND, StatusCode.NOT_FOUND);
        }

        await row.set({...data}).save();
        return;
    }

    static async deleteAwardAndNomination(user: User, id: number) {
        const row = await AwardAndNominationModel.findOne({
            where: {
                owner: user.identifier,
                id: id,
            }
        });

        if (row === null) {
            throw new ResponseError(ResponseMessage.DATA_NOT_FOUND, StatusCode.NOT_FOUND);
        }

        await row.destroy();
        return;
    }

    /** Membru în academii */
    static async getAcademyMember(user: User) {
        return (await AcademyMemberModel.findAll({
            where: {owner: user.identifier},
            order: ['id'],
        })).map(item => item.toJSON());
    }

    static async addAcademyMember(user: User, data: AcademyMember): Promise<any> {
        if (!UtilService.checkFormFields(data)) {
            throw new ResponseError(ResponseMessage.FORM_FIELD_ERROR, StatusCode.BAD_REQUEST);
        }

        await AcademyMemberModel.create({
            ...data,
            owner: user.identifier
        });
        return;
    }

    static async updateAcademyMember(user: User, formId: number, data: AcademyMember) {
        if (!UtilService.checkFormFields(data)) {
            throw new ResponseError(ResponseMessage.FORM_FIELD_ERROR, StatusCode.BAD_REQUEST);
        }

        const row = await AcademyMemberModel.findOne({
            where: {
                owner: user.identifier,
                id: formId,
            }
        });

        if (row === null) {
            throw new ResponseError(ResponseMessage.DATA_NOT_FOUND, StatusCode.NOT_FOUND);
        }

        await row.set({...data}).save();
        return;
    }

    static async deleteAcademyMember(user: User, id: number) {
        const row = await AcademyMemberModel.findOne({
            where: {
                owner: user.identifier,
                id: id,
            }
        });

        if (row === null) {
            throw new ResponseError(ResponseMessage.DATA_NOT_FOUND, StatusCode.NOT_FOUND);
        }

        await row.destroy();
        return;
    }

    /** Membru în echipa editorială */
    static async getEditorialMember(user: User) {
        return (await EditorialMemberModel.findAll({
            where: {owner: user.identifier},
            order: ['id'],
        })).map(item => item.toJSON());
    }

    static async addEditorialMember(user: User, data: EditorialMember): Promise<any> {
        if (!UtilService.checkFormFields(data)) {
            throw new ResponseError(ResponseMessage.FORM_FIELD_ERROR, StatusCode.BAD_REQUEST);
        }

        await EditorialMemberModel.create({
            ...data,
            owner: user.identifier
        });
        return;
    }

    static async updateEditorialMember(user: User, formId: number, data: EditorialMember) {
        if (!UtilService.checkFormFields(data)) {
            throw new ResponseError(ResponseMessage.FORM_FIELD_ERROR, StatusCode.BAD_REQUEST);
        }

        const row = await EditorialMemberModel.findOne({
            where: {
                owner: user.identifier,
                id: formId,
            }
        });

        if (row === null) {
            throw new ResponseError(ResponseMessage.DATA_NOT_FOUND, StatusCode.NOT_FOUND);
        }

        await row.set({...data}).save();
        return;
    }

    static async deleteEditorialMember(user: User, id: number) {
        const row = await EditorialMemberModel.findOne({
            where: {
                owner: user.identifier,
                id: id,
            }
        });

        if (row === null) {
            throw new ResponseError(ResponseMessage.DATA_NOT_FOUND, StatusCode.NOT_FOUND);
        }

        await row.destroy();
        return;
    }

    /** Evenimente organizate */
    static async getOrganizedEvent(user: User) {
        return (await OrganizedEventModel.findAll({
            where: {owner: user.identifier},
            order: ['id'],
        })).map(item => item.toJSON());
    }

    static async addOrganizedEvent(user: User, data: OrganizedEvent): Promise<any> {
        if (!UtilService.checkFormFields(data)) {
            throw new ResponseError(ResponseMessage.FORM_FIELD_ERROR, StatusCode.BAD_REQUEST);
        }

        await OrganizedEventModel.create({
            ...data,
            owner: user.identifier
        });
        return;
    }

    static async updateOrganizedEvent(user: User, formId: number, data: OrganizedEvent) {
        if (!UtilService.checkFormFields(data)) {
            throw new ResponseError(ResponseMessage.FORM_FIELD_ERROR, StatusCode.BAD_REQUEST);
        }

        const row = await OrganizedEventModel.findOne({
            where: {
                owner: user.identifier,
                id: formId,
            }
        });

        if (row === null) {
            throw new ResponseError(ResponseMessage.DATA_NOT_FOUND, StatusCode.NOT_FOUND);
        }

        await row.set({...data}).save();
        return;
    }

    static async deleteOrganizedEvent(user: User, id: number) {
        const row = await OrganizedEventModel.findOne({
            where: {
                owner: user.identifier,
                id: id,
            }
        });

        if (row === null) {
            throw new ResponseError(ResponseMessage.DATA_NOT_FOUND, StatusCode.NOT_FOUND);
        }

        await row.destroy();
        return;
    }

    /** Fără activitate științifică */
    static async getWithoutActivity(user: User) {
        return (await WithoutActivityModel.findAll({
            where: {owner: user.identifier},
            order: ['id'],
        })).map(item => item.toJSON());
    }

    static async addWithoutActivity(user: User, data: WithoutActivity): Promise<any> {
        if (!UtilService.checkFormFields(data)) {
            throw new ResponseError(ResponseMessage.FORM_FIELD_ERROR, StatusCode.BAD_REQUEST);
        }

        await WithoutActivityModel.create({
            ...data,
            owner: user.identifier
        });
        return;
    }

    static async updateWithoutActivity(user: User, formId: number, data: WithoutActivity) {
        if (!UtilService.checkFormFields(data)) {
            throw new ResponseError(ResponseMessage.FORM_FIELD_ERROR, StatusCode.BAD_REQUEST);
        }

        const row = await WithoutActivityModel.findOne({
            where: {
                owner: user.identifier,
                id: formId,
            }
        });

        if (row === null) {
            throw new ResponseError(ResponseMessage.DATA_NOT_FOUND, StatusCode.NOT_FOUND);
        }

        await row.set({...data}).save();
        return;
    }

    static async deleteWithoutActivity(user: User, id: number) {
        const row = await WithoutActivityModel.findOne({
            where: {
                owner: user.identifier,
                id: id,
            }
        });

        if (row === null) {
            throw new ResponseError(ResponseMessage.DATA_NOT_FOUND, StatusCode.NOT_FOUND);
        }

        await row.destroy();
        return;
    }

    /** Activitate didactică */
    static async getDidacticActivity(user: User) {
        return (await DidacticActivityModel.findAll({
            where: {owner: user.identifier},
            order: ['id'],
        })).map(item => item.toJSON());
    }

    static async addDidacticActivity(user: User, data: DidacticActivity): Promise<any> {
        if (!UtilService.checkFormFields(data)) {
            throw new ResponseError(ResponseMessage.FORM_FIELD_ERROR, StatusCode.BAD_REQUEST);
        }

        await DidacticActivityModel.create({
            ...data,
            owner: user.identifier
        });
        return;
    }

    static async updateDidacticActivity(user: User, formId: number, data: DidacticActivity) {
        if (!UtilService.checkFormFields(data)) {
            throw new ResponseError(ResponseMessage.FORM_FIELD_ERROR, StatusCode.BAD_REQUEST);
        }
        
        const row = await DidacticActivityModel.findOne({
            where: {
                owner: user.identifier,
                id: formId,
            }
        });

        if (row === null) {
            throw new ResponseError(ResponseMessage.DATA_NOT_FOUND, StatusCode.NOT_FOUND);
        }

        await row.set({...data}).save();
        return;
    }

    static async deleteDidacticActivity(user: User, id: number) {
        const row = await DidacticActivityModel.findOne({
            where: {
                owner: user.identifier,
                id: id,
            }
        });

        if (row === null) {
            throw new ResponseError(ResponseMessage.DATA_NOT_FOUND, StatusCode.NOT_FOUND);
        }

        await row.destroy();
        return;
    }

    /************************************************************************************
     *                               Admin only
     ***********************************************************************************/
    /* Get all the users except to the one that is making the request */
    static async allUsers(userExcept: User): Promise<any> {
        const rows = await UserModel.findAll({
            where: {
                id: {[Op.not]: userExcept.id},
            },
            order: ['id'],
        });

        return rows.map(item => item.toJSON());
    }

    static async deleteUser(id: number): Promise<void> {
        const row = await UserModel.findOne({
            where: {
                id: id
            }
        });

        if (row === null) {
            throw new ResponseError(ResponseMessage.DATA_NOT_FOUND, StatusCode.NOT_FOUND);
        }

        await row.destroy();
        return;
    }

    /* Get all base information except to the one that is making the request */
    static async getBaseInformation(user: User) {
        return (await BaseInformationModel.findAll({
            where: {
                identifier: {[Op.not]: user.identifier},
            },
            order: ['id'],
        })).map(item => item.toJSON());
    }

    static async importBaseInformation(file: UploadedFile): Promise<number> {
        const baseInformationList = XLSXService.parseExistingStudents(file);

        let rowsCreated = 0;
        for (let data of baseInformationList) {
            await BaseInformationModel.create(data as any);
            rowsCreated++;
        }

        return rowsCreated;
    }

    static async deleteBaseInformation(id: number) {
        const row = await BaseInformationModel.findOne({
            where: {
                id: id,
            }
        });

        if (row === null) {
            throw new ResponseError(ResponseMessage.DATA_NOT_FOUND, StatusCode.NOT_FOUND);
        }

        await row.destroy();
        return;
    }

    static async sendSemesterActivityEmail(emailTemplate: string, subject: string, from: string, file: UploadedFile, recipientExceptList: string[]): Promise<any> {
        const semesterActivityDataList = XLSXService.parseSemesterActivityTimetable(file);

        const emailResults: EmailResult[] = [];
        for (let data of semesterActivityDataList) {
            if (recipientExceptList.some(item => item === data.emailTo)) {
                continue;
            }

            let emailActivityContent = '';
            for (let row of data.professorActivity) {
                emailActivityContent += `${row.activity} ${row.weekHours} ore/saptamana <br>`;
            }

            const emailContent = emailTemplate.replace(new RegExp(/{{activity}}/g), emailActivityContent);

            /* Sending the email */

            try {
                await MailService.sendMail({
                    from: from,
                    subject: subject,
                    to: data.emailTo,
                    html: emailContent,
                });

                emailResults.push({email: data.emailTo, success: true});
            } catch (err) {
                console.log(err);
                emailResults.push({email: data.emailTo, success: false});
            }

        }

        return emailResults;
    }

    static async exportForms(): Promise<Buffer> {
        const XLSX = require('XLSX');

        let scArticleISI =     (await ScientificArticleISIModel.findAll({order: ['id'],})).map(item => item.toJSON());
        let isiProceedings =   (await ISIProceedingModel.findAll({order: ['id'],})).map(item => item.toJSON());
        let scArticleBDI =     (await ScientificArticleBDIModel.findAll({order: ['id'],})).map(item => item.toJSON());
        let scBook =           (await ScientificBookModel.findAll({order: ['id'],})).map(item => item.toJSON());
        let translation =      (await TranslationModel.findAll({order: ['id'],})).map(item => item.toJSON());
        let scCommunication =  (await ScientificCommunicationModel.findAll({order: ['id'],})).map(item => item.toJSON());
        let patent =           (await PatentModel.findAll({order: ['id'],})).map(item => item.toJSON());
        let researchContract = (await ResearchContractModel.findAll({order: ['id'],})).map(item => item.toJSON());
        let citation =         (await CitationModel.findAll({order: ['id'],})).map(item => item.toJSON());
        let awardsNomination = (await AwardAndNominationModel.findAll({order: ['id'],})).map(item => item.toJSON());
        let academyMember =    (await AcademyMemberModel.findAll({order: ['id'],})).map(item => item.toJSON());
        let editorialMember =  (await EditorialMemberModel.findAll({order: ['id'],})).map(item => item.toJSON());
        let organizedEvent =   (await OrganizedEventModel.findAll({order: ['id'],})).map(item => item.toJSON());
        let withoutActivity =  (await WithoutActivityModel.findAll({order: ['id'],})).map(item => item.toJSON());
        let didacticActivity = (await DidacticActivityModel.findAll({order: ['id'],})).map(item => item.toJSON());

        const scISISheet = FormsService.getScientificArticleISISheet(scArticleISI);
        const isiProceedingsSheet = FormsService.getISIProceedingsSheet(isiProceedings);
        const scArticleBDISheet = FormsService.getScientificArticleBDISheet(scArticleBDI);
        const scBookSheet = FormsService.getScientificBookSheet(scBook);
        const translationSheet = FormsService.getTranslationSheet(translation);
        const scCommunicationSheet = FormsService.getScientificCommunicationSheet(scCommunication);
        const patentSheet = FormsService.getPatentSheet(patent);
        const researchContractSheet = FormsService.getResearchContractSheet(researchContract);
        const citationSheet = FormsService.getCitationSheet(citation);
        const awardsNominationSheet = FormsService.getAwardAndNominationSheet(awardsNomination);
        const academyMemberSheet = FormsService.getAcademyMemberSheet(academyMember);
        const editorialMemberSheet = FormsService.getEditorialMemberSheet(editorialMember);
        const organizedEventSheet = FormsService.getOrganizedEventSheet(organizedEvent);
        const withoutActivitySheet = FormsService.getWithoutActivitySheet(withoutActivity);
        const didacticActivitySheet = FormsService.getDidacticActivitySheet(didacticActivity);

        const workBook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workBook, scISISheet, 'Articole ştiintifice...ISI...');
        XLSX.utils.book_append_sheet(workBook, isiProceedingsSheet, 'ISI proceedings');
        XLSX.utils.book_append_sheet(workBook, scArticleBDISheet, 'Articole științifice...BDI..');
        XLSX.utils.book_append_sheet(workBook, scBookSheet, 'Cărţi ştiinţifice...');
        XLSX.utils.book_append_sheet(workBook, translationSheet, 'Traduceri');
        XLSX.utils.book_append_sheet(workBook, scCommunicationSheet, 'Comunicări...');
        XLSX.utils.book_append_sheet(workBook, patentSheet, 'Brevete');
        XLSX.utils.book_append_sheet(workBook, researchContractSheet, 'Contracte de cercetare');
        XLSX.utils.book_append_sheet(workBook, citationSheet, 'Citări');
        XLSX.utils.book_append_sheet(workBook, awardsNominationSheet, 'Premii si nominalizari');
        XLSX.utils.book_append_sheet(workBook, academyMemberSheet, 'Membru în academii');
        XLSX.utils.book_append_sheet(workBook, editorialMemberSheet, 'Membru în echipa editorială');
        XLSX.utils.book_append_sheet(workBook, organizedEventSheet, 'Evenimente organizate');
        XLSX.utils.book_append_sheet(workBook, withoutActivitySheet, 'Fără activitate științifică');
        XLSX.utils.book_append_sheet(workBook, didacticActivitySheet, 'Activitate didactică');

        /* Generate Excel Buffer and return */
        return new Buffer(XLSX.write(workBook, {bookType: 'xlsx', type: 'buffer'}));
    }

    static async faz(timetableFile: UploadedFile, ignoreStart: number, ignoreEnd: number): Promise<any> {
        const fazProfessorDataList = XLSXService.parseFAZ(timetableFile, ignoreStart, ignoreEnd);

        const zip = new JSZip();

        for (let data of fazProfessorDataList) {
            const docxBuffer = DocxService.getFazDOCXBuffer(data);

            /* Append the buffer to the zip */
            zip.file(`FAZ ${data.professorFunction} ${data.professorName}.docx`, docxBuffer, {compression: 'DEFLATE'});
        }

        return await zip.generateAsync( { type : "nodebuffer", compression: 'DEFLATE' });
    }

    static async sendVerbalProcess(file: UploadedFile): Promise<Buffer> {
        const verbalProcessDataList = XLSXService.parseReportAnnouncement(file);

        for (let data of verbalProcessDataList) {
            const buffer = await DocxService.getVerbalProcessDOCXBuffer(data);

            return buffer;
        }

        return new Buffer('');
    }

    static async sendThesisEmailNotification(emailTemplate: string, subject: string, from: string, file: UploadedFile, recipientExceptList: string[]) {
        const verbalProcessDataList = XLSXService.parseReportAnnouncement(file);

        const emailResults: EmailResult[] = [];

        for (const data of verbalProcessDataList) {
            if (recipientExceptList.some(item => item === data.email)) {
                continue;
            }

            let commission = '';
            commission += `${data.coordinators[1].coordinatorName}<br>`;
            commission += `${data.coordinators[2].coordinatorName}<br>`;
            commission += `${data.coordinators[3].coordinatorName}<br>`;

            let emailContent = emailTemplate;
            emailContent = emailContent.replace(new RegExp(/{{date}}/g), UtilService.simpleStringDate(data.presentationDate));
            emailContent = emailContent.replace(new RegExp(/{{reportTitle}}/g), data.reportTitle);
            emailContent = emailContent.replace(new RegExp(/{{coordinator}}/g), data.coordinators[0].coordinatorName);
            emailContent = emailContent.replace(new RegExp(/{{commission}}/g), commission);

            try {
                await MailService.sendMail({
                    subject: subject,
                    from: from,
                    to: data.email,
                    cc: [data.coordinatorEmail],
                    html: emailContent,
                });

                emailResults.push({
                    email: data.email,
                    success: true,
                });
            } catch (err) {
                console.log(err);

                emailResults.push({
                   email: data.email,
                   success: false,
                });
            }
        }

        return emailResults;
    }

}