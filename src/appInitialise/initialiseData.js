import { filter } from 'lodash/fp';
import { configFolder, appDefinitionFile, $ } from '../common';
import { TRANSACTIONS_FOLDER } from '../transactions/transactionsCommon';
import { AUTH_FOLDER, USERS_LIST_FILE, ACCESS_LEVELS_FILE } from '../authApi/authCommon';
import { initialiseRootCollections, initialiseRootIndexes, initialiseRootSingleRecords } from '../collectionApi/initialise';
import { _save } from '../recordApi/save';

export const initialiseData = async (datastore, applicationDefinition, accessLevels) => {
  await datastore.createFolder(configFolder);
  await datastore.createJson(appDefinitionFile, applicationDefinition);

  await initialiseRootCollections(datastore, applicationDefinition.hierarchy);
  await initialiseRootIndexes(datastore, applicationDefinition.hierarchy);

  await initialiseRootSingleRecords(datastore, applicationDefinition.hierarchy);

  await datastore.createFolder(TRANSACTIONS_FOLDER);

  await datastore.createFolder(AUTH_FOLDER);

  await datastore.createJson(USERS_LIST_FILE, []);

  await datastore.createJson(
    ACCESS_LEVELS_FILE,
    accessLevels ? accessLevels : { version: 0, levels: [] });
};


