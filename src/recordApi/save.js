import {cloneDeep, constant} from "lodash/fp";
import {initialiseChildCollections} from "../collectionApi/initialise";
import {validate} from "./validate";
import {onSaveInvalid, onRecordCreated, 
    onRecordUpdated} from "./events";
import {load} from "./load";
import {apiWrapper} from "../common";

export const save = (app,indexingApi) => async (record, context) => 
    apiWrapper(
        app,
        "recordApi","save", 
        {record},
        _save, app,indexingApi, record, context);


const _save = async (app,indexingApi, record, context) => {
    const recordClone = cloneDeep(record);

    const validationResult = validate(app)
                                     (recordClone, context);
    if(!validationResult.isValid) {
        app.publish(onSaveInvalid, {record,validationResult});
        throw new Error("Save : Record Invalid : " + JSON.stringify(validationResult.errors));
    }

    const returnedClone = cloneDeep(record);
    returnedClone.isNew = constant(false);

    recordClone.type = record.type();
    if(recordClone.isNew()) {
        await app.datastore.createJson(recordClone.key(), recordClone);
        await initialiseChildCollections(app, recordClone.key());
        app.publish(onRecordCreated, {record:recordClone});
        await indexingApi.reindexForCreate(recordClone);
    }
    else {
        const loadRecord = load(app);
        const oldRecord = await loadRecord(recordClone.key());
        await app.datastore.updateJson(recordClone.key(), recordClone);
        
        app.publish(onRecordUpdated, {
            old:oldRecord,
            new:returnedClone
        });
        
        await indexingApi.reindexForUpdate(oldRecord, recordClone);
    }
   
    return returnedClone;
};
