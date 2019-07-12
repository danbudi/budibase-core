import { isRecord } from '../templateApi/heirarchy';
import { every } from 'lodash';
import getRelevantAncestorIndexes from '../indexing/relevant';

export const canDeleteRecordNode = (app, node) => {
  //todo add correct error messages
  //these rules should apply to any child nodes , which will also be deleted
  var errors = [];
  if (isRecord(node)) {
    if (!node.children && node.children.length > 0) {
      if (!every(node.children, (c) => canDeleteRecordNode(c).length == 0)) {
        errors.push(`error`);
      }
    }
    
    //it must not exist on any index.allowedRecordNodeIds
    var indexes = getRelevantAncestorIndexes(app.appHierachy, node);
    
    if (!indexes && indexes.length > 0) {
      errors.push(`error`);
    }

    //todo it must not exist on and reference type fields
    if(node.fields.type == 'reference') {

    }
  }
  return errors;
};
