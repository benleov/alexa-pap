# Alexa - Pick a path adventure

# Introduction

This project allows you to create your own voice based pick a path adventure which is described as JSON in Dynamo DB.


### Pre-requisites

* Node.js (> v4.3)
* The [ask CLI](https://developer.amazon.com/docs/smapi/quick-start-alexa-skills-kit-command-line-interface.html)
* Register for an [AWS Account](https://aws.amazon.com/)
* Register for an [Amazon Developer Account](https://developer.amazon.com/)

# General setup

1. Install ask cli & run ``` ask init ``` to link with your account

1. Clone the repository.

	```bash
	$ git clone https://github.com/benleov/alexa-pap.git
	```

1. Navigating into the repository's root folder.

	```bash
	$ cd alexa-pap
	```

1. Install npm dependencies by navigating into the `lambda/` directory and running the npm command: `npm install`

	```bash
	$ cd lambda/
	$ npm install
	```
	
### Repository Contents

* `/lambda/` - The lambda function that processes requests from alexa
* `/examples/sample-story.json`	- An example story stored in DynamoDB

### Deployment

ASK CLI will create the skill and the lambda function for you. The Lambda function will be created in ```us-east-1 (Northern Virginia)``` by default

1. Deploy the skill and the lambda function in one step by running the following command:

	```bash
	$ cd .. # to get back to the root directory
	$ ask deploy
	```

2. Once deployed, additional permissions need to be added to the AWS IAM role being used by the skill since it is persisting data in Amazon DynamoDB.  Navigate to the [AWS IAM console](https://console.aws.amazon.com/iam/home#/roles).

	> _Note: We are adding the full access policy here for convenience.  For a production skill, you should use a more targeted policy restricting access to just the required resources.  Refer to the [DynamoDB documentation](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/access-control-overview.html) for more details._

	1. Locate the role for your skill (by default, it is named ```ask-lambda-<your skill name>```).
	1. Click on the role, then click **Attach Policy**.
	1. Search for **AmazonDynamoDBFullAccess** and click the check box next to it.
	1. Click **Attach Policy**.

#### If you deploy this manually (not using the ask cli), please note that:

- You need to make sure that your Alexa is in the same region and using locale as what you have deployed.
- You need to deploy the lambda that supports Alexa, such as Ireland (eu-west-1)

### Creating your story

- Create row in the Pick-A-Path table within dynamo db with key "story"
- Using an editor like https://jsoneditoronline.org/ is easier than using DynamoDB to edit the story as the latter will 
rearrange the children elements to be at the top making it difficult to work with.
- Modify speech with https://developer.amazon.com/docs/custom-skills/speech-synthesis-markup-language-ssml-reference.html
- An example is in ``` /examples/example-story.json ```

### Testing

1. To test, you need to login to Alexa Developer Console, and enable the "Test" switch on your skill from the "Test" Tab.

2. Simulate verbal interaction with your skill through the command line using the following example:

	```bash
	 $ ask simulate -l en-US -t "start pick a path game"

	 ✓ Simulation created for simulation id: 4a7a9ed8-94b2-40c0-b3bd-fb63d9887fa7
	  Waiting for simulation response{
	  "status": "SUCCESSFUL",
	  ...
	 ```

> _Note: if you did not add the DynamoDB permission as described in the previous step, the skill will return an error and you will see an error in your CloudWatch Logs reporting:  ...```Coud not read item```...```is not authorized to perform: dynamodb:GetItem```..._

3. Once the "Test" switch is enabled, your skill can be tested on devices associated with the developer account as well. Speak to Alexa from any enabled device, from your browser at [echosim.io](https://echosim.io/welcome), or through your Amazon Mobile App and say :

	```text
	Alexa, start pick a path game
	```
