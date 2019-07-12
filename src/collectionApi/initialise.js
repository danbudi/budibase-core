import { filter } from 'lodash/fp';
import {
  getFlattenedHierarchy,
  isCollectionRecord,
  isRoot,
  getExactNodeForPath,
  isGlobalIndex,
  isSingleRecord
} from '../templateApi/hierarchy';
import { initialiseIndex } from '../indexing/initialiseIndex';
import { $, allTrue, joinKey } from '../common';

const ensureCollectionIsInitialised = async (datastore, node, parentKey) => {
  if (!await datastore.exists(parentKey)) {
    await datastore.createFolder(parentKey);
    await datastore.createFolder(
      joinKey(parentKey, 'allids'),
    );
    await datastore.createFolder(
      joinKey(
        parentKey,
        'allids',
        node.nodeId.toString(),
      ),
    );
  }
};

export const initialiseRootCollections = async (datastore, hierarchy) => {
  const rootCollectionRecord = allTrue(
    n => isRoot(n.parent()),
    isCollectionRecord,
  );

  const flathierarchy = getFlattenedHierarchy(hierarchy);

  const collectionRecords = $(flathierarchy, [
    filter(rootCollectionRecord),
  ]);

  for (const col of collectionRecords) {
    await ensureCollectionIsInitialised(
      datastore,
      col,
      col.collectionPathRegx(),
    );
  }
};

export const initialiseChildCollections = async (app, recordKey) => {
  const childCollectionRecords = $(recordKey, [
    getExactNodeForPath(app.hierarchy),
    n => n.children,
    filter(isCollectionRecord),
  ]);

  for (const child of childCollectionRecords) {
    await ensureCollectionIsInitialised(
      app.datastore,
      child,
      joinKey(recordKey, child.collectionName),
    );
  }
};

export const initialiseRootSingleRecords = async (datastore, hierachy) => {
  const rootSingleRecords = allTrue(
    n => isRoot(n.parent()),
    isSingleRecord,
  );

  const flathierarchy = getFlattenedHierarchy(hierachy);

  const singleRecords = $(flathierarchy, [
    filter(rootSingleRecords),
  ]);

  for (let record of singleRecords) {
    ensureSingleRecordIsInitialised(datastore, record, record.parent().nodeKey())
  }
};

const ensureSingleRecordIsInitialised = async (datastore, record, parentKey) => {
  await datastore.createJson(
    joinKey(
      parentKey,
      record.name
    ),
    record
  );
};

export const initialiseRootIndexes = async (datastore, hierarchy) => {
  const flathierarchy = getFlattenedHierarchy(hierarchy);
  const globalIndexes = $(flathierarchy, [
    filter(isGlobalIndex),
  ]);

  for (const index of globalIndexes) {
    if (!await datastore.exists(index.nodeKey())) { await initialiseIndex(datastore, '', index); }
  }
};
