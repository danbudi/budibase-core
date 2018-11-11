// name not null
// name(path?) not duplicated
// view.index has a map 
// view.index.map produces an object with memebers
// record has fields
// collection has type/children
// field types recognised
// field names valid

import {$, isSomething, switchCase
        ,anyTrue, isNonEmptyArray
        , isNonEmptyString, defaultCase
        , executesWithoutException,
        somethingOrDefault} from "../common";
import {isCollection, isRecord, isRoot, 
        isView, getFlattenedHierarchy} from "./heirarchy";
import {filter, union, constant, 
        map, flatten, every, uniqBy,
        some, includes} from "lodash/fp";
import {has} from "lodash";
import {compileFilter, compileMap} from "../indexing/evaluate";
import {eventsList} from "../common/events";


const stringNotEmpty = s => isSomething(s) && s.trim().length > 0;

const validationError = (rule, item) => ({...rule, item});
export const makerule = (field, error, isValid) => ({field, error, isValid});


const commonRules = [
    makerule("name", "node name is not set", 
         node => stringNotEmpty(node.name)),
    makerule("type", "node type not recognised",
        anyTrue(isRecord, isCollection, isRoot, isView ))
];

const recordRules = [
    makerule("fields", "no fields have been added to the record",
        node => isNonEmptyArray(node.fields)),
    makerule("validationRules", "validation rule is missing a 'messageWhenValid' member",
        node => every(r => has(r, "messageWhenInvalid"))
                (node.validationRules)),
    makerule("validationRules", "validation rule is missing a 'expressionWhenValid' member",
        node => every(r => has(r, "expressionWhenValid"))
                (node.validationRules)),
];

const collectionRules = [
    makerule("children", "collection does not have and children",
        node => isNonEmptyArray(node.children))
];
const viewRules = [
    makerule("index", "view index has no map function",
        node => isNonEmptyString(node.index.map)),
    makerule("index", "view index's map function does not compile",
        node => !isNonEmptyString(node.index.map)
                || executesWithoutException(() => compileMap(node.index))),
    makerule("index", "view index's filter function does not compile",
        node => !isNonEmptyString(node.index.filter)
                ||  executesWithoutException(() => compileFilter(node.index)))
];

const ruleSet = (...sets) => 
    constant(union(...sets));

const applyRule = itemTovalidate => rule => 
    rule.isValid(itemTovalidate) 
    ? null
    : validationError(rule, itemTovalidate);


const getRuleSet = 
    switchCase(
        [isCollection, ruleSet(commonRules, collectionRules)],
        [isRecord, ruleSet(commonRules, recordRules)],
        [isView, ruleSet(commonRules, viewRules)],
        [defaultCase, ruleSet(commonRules, [])]
    );

const applyRuleSet = (itemToValidate, ruleSet) => 
    $(ruleSet, [
        map(applyRule(itemToValidate)),
        filter(isSomething)
    ]);

export const validateNode = node => 
    applyRuleSet(node, getRuleSet(node));

export const validateAll = appHeirarchy => 
    $(appHeirarchy, [
        getFlattenedHierarchy,
        map(validateNode),
        flatten
    ]);

const actionRules = [
    makerule("name", "action must have a name", 
        a => isNonEmptyString(a.name)),
    makerule("behaviourName", "must supply a behaviour name to the action",
        a => isNonEmptyString(a.behaviourName)),
    makerule("behaviourSource", "must supply a behaviour source for the action",
        a => isNonEmptyString(a.behaviourSource)),
];

const duplicateActionRule = 
    makerule("", "action name must be unique", () =>{});

const validateAction = action => 
    applyRuleSet(action, actionRules);


export const validateActions = (allActions) => {
    
    const duplicateActions = $(allActions, [
        filter(a => filter(a2 => a2.name === a.name)
                          (allActions).length > 1),
        map(a => validationError(duplicateActionRule, a))
    ]);
    
    const errors = $(allActions, [
        map(validateAction),
        flatten,
        union(duplicateActions),
        uniqBy("name")
    ]);

    return errors;
};

const triggerRules = actions => ([
    makerule("actionName", "must specify an action", 
        t => isNonEmptyString(t.actionName)),
    makerule("eventName", "must specify and event",
        t => isNonEmptyString(t.eventName)),
    makerule("actionName", "specified action not supplied",
        t => !t.actionName 
             || some(a => a.name === t.actionName)(actions)),
    makerule("eventName", "invalid Event Name",
        t => !t.eventName 
             || includes(t.eventName)(eventsList))
]);

export const validateTrigger = (trigger, allActions) => {

    const errors = applyRuleSet(trigger, triggerRules(allActions));

    return errors;
};
    