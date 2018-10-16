/* eslint-disable  func-names */
/* eslint-disable  no-console */
/* eslint-disable  no-restricted-syntax */

const Alexa = require('ask-sdk');
const TreeModel = require('tree-model');
const AWS = require('aws-sdk');
const {promisify} = require('util');

const FALLBACK_MESSAGE_DURING_GAME = `This skill can't help you with that.`;
const FALLBACK_REPROMPT_DURING_GAME = `This skill can't help you with that.`;
const FALLBACK_MESSAGE_OUTSIDE_GAME = `The skill can't help you with that.`;
const FALLBACK_REPROMPT_OUTSIDE_GAME = 'Say yes to start the game or no to quit.';

const dynamoDB = new AWS.DynamoDB();
const dbGet = promisify(dynamoDB.getItem).bind(dynamoDB);

/**
 * Dynamo query to get the story row.
 */
const params = {
    TableName: 'Pick-A-Path',
    Key: {
        'id' : {S: 'story'},
    }
};

const LaunchRequest = {
    canHandle(handlerInput) {
        // launch requests as well as any new session, as games are not saved in progress, which makes
        // no one shots a reasonable idea except for help, and the welcome message provides some help.
        return handlerInput.requestEnvelope.session.new || handlerInput.requestEnvelope.request.type === 'LaunchRequest';
    },
    async handle(handlerInput) {

        const attributesManager = handlerInput.attributesManager;
        const responseBuilder = handlerInput.responseBuilder;

        const attributes = await attributesManager.getPersistentAttributes() || {};
        if (Object.keys(attributes).length === 0) {
            attributes.endedSessionCount = 0;
            attributes.gameState = 'ENDED';
        }

        attributesManager.setSessionAttributes(attributes);

        const reprompt = 'Say yes to start the game or no to quit.';

        let data = await dbGet(params);

        if(data && data.Item) {

            const converted = AWS.DynamoDB.Converter.unmarshall(data.Item);
            const tree = new TreeModel();
            let root = tree.parse(converted);

            return responseBuilder
                .speak(root.model.initSpeak)
                .reprompt(reprompt)
                .getResponse();
        } else {

            // cannot find story row

            // const {requestEnvelope, attributesManager, responseBuilder} = handlerInput;
            // const sessionAttributes = attributesManager.getSessionAttributes();
            // sessionAttributes.gameState = 'ENDED';
            // sessionAttributes.currentNodeId = 'story';
            // attributesManager.setPersistentAttributes(sessionAttributes);
            // await attributesManager.savePersistentAttributes();

            return responseBuilder
                .speak("The story cannot be found. Please read the Readme file for more information.")
                .reprompt("Say no to exit.")
                .getResponse();

        }
    },
};

const ExitHandler = {
    canHandle(handlerInput) {
        const request = handlerInput.requestEnvelope.request;

        return request.type === 'IntentRequest'
            && (request.intent.name === 'AMAZON.CancelIntent'
                || request.intent.name === 'AMAZON.StopIntent');
    },
    handle(handlerInput) {
        return handlerInput.responseBuilder
            .speak('Thanks for playing.')
            .getResponse();
    },
};

const SessionEndedRequest = {
    canHandle(handlerInput) {
        return handlerInput.requestEnvelope.request.type === 'SessionEndedRequest';
    },
    handle(handlerInput) {
        console.log(`Session ended with reason: ${handlerInput.requestEnvelope.request.reason}`);
        return handlerInput.responseBuilder.getResponse();
    },
};

const HelpIntent = {
    canHandle(handlerInput) {
        const request = handlerInput.requestEnvelope.request;

        return request.type === 'IntentRequest' && request.intent.name === 'AMAZON.HelpIntent';
    },
    handle(handlerInput) {
        const speechOutput = 'You ask for help, but there is none.';
        const reprompt = 'You ask for help, but there is none.';

        return handlerInput.responseBuilder
            .speak(speechOutput)
            .reprompt(reprompt)
            .getResponse();
    },
};

const YesIntent = {
    canHandle(handlerInput) {
        // only start a new game if yes is said when not playing a game.
        let isCurrentlyPlaying = false;
        const request = handlerInput.requestEnvelope.request;
        const attributesManager = handlerInput.attributesManager;
        const sessionAttributes = attributesManager.getSessionAttributes();

        if (sessionAttributes.gameState &&
            sessionAttributes.gameState === 'STARTED') {
            isCurrentlyPlaying = true;
        }

        return !isCurrentlyPlaying && request.type === 'IntentRequest' && request.intent.name === 'AMAZON.YesIntent';
    },
    async handle(handlerInput) {
        const attributesManager = handlerInput.attributesManager;
        const responseBuilder = handlerInput.responseBuilder;
        const sessionAttributes = attributesManager.getSessionAttributes();

        sessionAttributes.gameState = 'STARTED';
        sessionAttributes.currentNode = 'story';

        let data = await dbGet(params);
        const converted = AWS.DynamoDB.Converter.unmarshall(data.Item);
        const tree = new TreeModel();
        let root = tree.parse(converted);

        return responseBuilder
            .speak(root.model.speak)
            .reprompt(root.model.speak.repromptSpeak)
            .getResponse();
    },
};

const NoIntent = {
    canHandle(handlerInput) {
        // only treat no as an exit when outside a game
        let isCurrentlyPlaying = false;
        const request = handlerInput.requestEnvelope.request;
        const attributesManager = handlerInput.attributesManager;
        const sessionAttributes = attributesManager.getSessionAttributes();

        if (sessionAttributes.gameState &&
            sessionAttributes.gameState === 'STARTED') {
            isCurrentlyPlaying = true;
        }

        return !isCurrentlyPlaying && request.type === 'IntentRequest' && request.intent.name === 'AMAZON.NoIntent';
    },
    async handle(handlerInput) {
        const attributesManager = handlerInput.attributesManager;
        const responseBuilder = handlerInput.responseBuilder;
        const sessionAttributes = attributesManager.getSessionAttributes();

        sessionAttributes.endedSessionCount += 1;
        sessionAttributes.gameState = 'ENDED';
        attributesManager.setPersistentAttributes(sessionAttributes);

        await attributesManager.savePersistentAttributes();

        let data = await dbGet(params);
        const converted = AWS.DynamoDB.Converter.unmarshall(data.Item);
        const tree = new TreeModel();
        let root = tree.parse(converted);

        return responseBuilder.speak(root.model.initialEndSpeak).getResponse();
    },
};

const UnhandledIntent = {
    canHandle() {
        return true;
    },
    handle(handlerInput) {
        const outputSpeech = 'Say yes to continue, or no to end the game.';
        return handlerInput.responseBuilder
            .speak(outputSpeech)
            .reprompt(outputSpeech)
            .getResponse();
    },
};

/**
 *
 * @type {{canHandle(*): *, handle(*): Promise<*>}}
 */
const ChoiceIntent = {
    canHandle(handlerInput) {

        // handle numbers only during a game
        let isCurrentlyPlaying = false;
        const request = handlerInput.requestEnvelope.request;
        const attributesManager = handlerInput.attributesManager;
        const sessionAttributes = attributesManager.getSessionAttributes();

        if (sessionAttributes.gameState &&
            sessionAttributes.gameState === 'STARTED') {
            isCurrentlyPlaying = true;
        }

        return isCurrentlyPlaying && request.type === 'IntentRequest' && request.intent.name === 'ChoiceIntent';
    },
    async handle(handlerInput) {

        let data = await dbGet(params);

        const {requestEnvelope, attributesManager, responseBuilder} = handlerInput;

        const sessionAttributes = attributesManager.getSessionAttributes();

        const converted = AWS.DynamoDB.Converter.unmarshall(data.Item);

        const tree = new TreeModel();
        let root = tree.parse(converted);

        const nextNodeId = requestEnvelope.request.intent.slots.number.value;

        const nextNode = root.first(function (node) {
            return node.model.id.toString() === nextNodeId.toString();
        });

        if(nextNode == null) {

            // this option is completely invalid (doesn't exist anywhere)
            return responseBuilder
                .speak(root.model.invalidOptionSpeak)
                .reprompt(root.model.repromptSpeak)
                .getResponse();
        } else {

            let currentNodeId = sessionAttributes.currentNode;

            const currentNode = root.first(function (node) {
                return node.model.id.toString() === currentNodeId.toString();
            });

            if(currentNode.hasChildren()) {

                // search from the current node
                const options = currentNode.first(function(node) {

                    if(node.isRoot()) {
                        // this is the root node
                        return false;
                    } else {
                        // check the node's parent is the current node
                        return node.parent.model.id.toString() === currentNode.model.id.toString()
                            && node.model.id.toString() ===  nextNodeId.toString();
                    }
                });

                if(!options) { // this option doesn't exist as a child
                    return responseBuilder
                        .speak(root.model.invalidMoveSpeak)
                        .reprompt(currentNode.model.speak)
                        .getResponse();
                } else {

                    // player has moved
                    sessionAttributes.currentNode = nextNodeId;

                    let finishedSpeak = nextNode.hasChildren() ? "" : " " + root.model.finishedGameSpeak;

                    return responseBuilder
                        .speak(nextNode.model.speak + finishedSpeak)
                        .reprompt("You have finished the adventure.")
                        .getResponse();
                }

            } else {
                return responseBuilder
                    .speak(root.model.finishedGameSpeak)
                    .reprompt(root.model.finishedGameSpeak)
                    .getResponse();
            }
        }
    },
};

const ErrorHandler = {
    canHandle() {
        return true;
    },
    handle(handlerInput, error) {
        console.log(`Error handled: ${error.message}`);

        return handlerInput.responseBuilder
            .speak('Sorry, I can\'t understand the command. Please say again.')
            .reprompt('Sorry, I can\'t understand the command. Please say again.')
            .getResponse();
    },
};

const FallbackHandler = {
    // 2018-May-01: AMAZON.FallackIntent is only currently available in en-US locale.
    //              This handler will not be triggered except in that locale, so it can be
    //              safely deployed for any locale.
    canHandle(handlerInput) {
        // handle fallback intent, yes and no when playing a game
        // for yes and no, will only get here if and not caught by the normal intent handler
        const request = handlerInput.requestEnvelope.request;
        return request.type === 'IntentRequest' &&
            (request.intent.name === 'AMAZON.FallbackIntent' ||
                request.intent.name === 'AMAZON.YesIntent' ||
                request.intent.name === 'AMAZON.NoIntent');
    },
    handle(handlerInput) {
        const attributesManager = handlerInput.attributesManager;
        const sessionAttributes = attributesManager.getSessionAttributes();

        if (sessionAttributes.gameState &&
            sessionAttributes.gameState === 'STARTED') {
            // currently playing

            return handlerInput.responseBuilder
                .speak(FALLBACK_MESSAGE_DURING_GAME)
                .reprompt(FALLBACK_REPROMPT_DURING_GAME)
                .getResponse();
        }

        // not playing
        return handlerInput.responseBuilder
            .speak(FALLBACK_MESSAGE_OUTSIDE_GAME)
            .reprompt(FALLBACK_REPROMPT_OUTSIDE_GAME)
            .getResponse();
    },
};

const skillBuilder = Alexa.SkillBuilders.standard();

exports.handler = skillBuilder
    .addRequestHandlers(
        LaunchRequest,
        ExitHandler,
        SessionEndedRequest,
        HelpIntent,
        YesIntent,
        NoIntent,
        ChoiceIntent,
        FallbackHandler,
        UnhandledIntent,
    )
    .addErrorHandlers(ErrorHandler)
    .withTableName('Pick-A-Path')
    .withAutoCreateTable(true)
    .lambda();
