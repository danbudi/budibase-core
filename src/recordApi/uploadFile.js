import {
  includes, filter,
  map, some,
} from 'lodash/fp';
import { generate } from 'shortid';
import { _load } from './load';
import {
  apiWrapper, events, splitKey,
  $, joinKey, isNothing, tryAwaitOrIgnore,
} from '../common';
import { getExactNodeForPath } from '../templateApi/hierarchy';
import { permission } from '../authApi/permissions';
import { isLegalFilename } from '../types/file';

export const uploadFile = app => async (recordKey, readableStream, relativeFilePath) => apiWrapper(
  app,
  events.recordApi.uploadFile,
  permission.updateRecord.isAuthorized(recordKey),
  { recordKey, readableStream, relativeFilePath },
  _uploadFile, app, recordKey, readableStream, relativeFilePath,
);

const _uploadFile = async (app, recordKey, readableStream, relativeFilePath) => {
  if (isNothing(recordKey)) { throw new Error('Record Key not supplied'); }
  if (isNothing(relativeFilePath)) { throw new Error('file path not supplied'); }
  if (!isLegalFilename(relativeFilePath)) { throw new Error('Illegal filename'); }

  const record = await _load(app, recordKey);

  const fullFilePath = safeGetFullFilePath(
    recordKey, relativeFilePath,
  );

  const tempFilePath = `${fullFilePath}_${generate()}.temp`;

  const outputStream = await app.datastore.writableFileStream(
    tempFilePath,
  );

  return new Promise((resolve,reject) => {
    readableStream.pipe(outputStream);
    outputStream.on('error', reject);
    outputStream.on('finish', resolve);
  })
  .then(() => app.datastore.getFileSize(tempFilePath))
  .then(size => {
    const isExpectedFileSize = checkFileSizeAgainstFields(
      app, record, relativeFilePath, size
    );  
    if (!isExpectedFileSize) { throw new Error(`Fields for ${relativeFilePath} do not have expected size: ${join(',')(incorrectFields)}`); }  

  })
  .then(() => tryAwaitOrIgnore(app.datastore.deleteFile, fullFilePath))
  .then(() => app.datastore.renameFile(tempFilePath, fullFilePath));

  /*
  readableStream.pipe(outputStream);

  await new Promise(fulfill => outputStream.on('finish', fulfill));

  const isExpectedFileSize = checkFileSizeAgainstFields(
    app,
    record, relativeFilePath,
    await app.datastore.getFileSize(tempFilePath),
  );

  if (!isExpectedFileSize) {
    throw new Error(
      `Fields for ${relativeFilePath} do not have expected size`);
  }

  await tryAwaitOrIgnore(app.datastore.deleteFile, fullFilePath);

  await app.datastore.renameFile(tempFilePath, fullFilePath);
  */
};

const checkFileSizeAgainstFields = (app, record, relativeFilePath, expectedSize) => {
  const recordNode = getExactNodeForPath(app.hierarchy)(record.key);

  const incorrectFileFields = $(recordNode.fields, [
    filter(f => f.type === 'file'
      && record[f.name].relativePath === relativeFilePath
      && record[f.name].size !== expectedSize),
    map(f => f.name),
  ]);

  const incorrectFileArrayFields = $(recordNode.fields, [
    filter(a => a.type === 'array<file>'
      && $(record[a.name], [
        some(f => record[f.name].relativePath === relativeFilePath
          && record[f.name].size !== expectedSize),
      ])),
    map(f => f.name),
  ]);

  const incorrectFields = [
    ...incorrectFileFields,
    ...incorrectFileArrayFields,
  ];

  if (incorrectFields.length > 0) {
    return false;
  }

  return true;
};

export const safeGetFullFilePath = (recordKey, relativeFilePath) => {
  const naughtyUser = () => { throw new Error('naughty naughty'); };

  if (relativeFilePath.startsWith('..')) naughtyUser();

  const pathParts = splitKey(relativeFilePath);

  if (includes('..')(pathParts)) naughtyUser();

  const recordKeyParts = splitKey(recordKey);

  const fullPathParts = [
    ...recordKeyParts,
    'files',
    ...filter(p => p !== '.')(pathParts),
  ];

  return joinKey(fullPathParts);
};
