pipeline {
    agent any
    environment {
        AWS_ACCOUNT_ID = credentials('aws-account-id')
        AWS_DEFAULT_REGION = 'us-east-1'
        ECR_REPO_FRONTEND = 'awad-frontend'
        ECR_REPO_BACKEND = 'awad-backend'
        EC2_INSTANCE_TAG = 'awad-prod-instance'
        AWS_SECRET_ID = 'awad/prod/env'
    // IMAGE_TAG will be set dynamically
    }
    stages {
        stage('Setup') {
            steps {
                sh '''
          export NVM_DIR="$HOME/.nvm"
          [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"

          node -v
          npm -v
        '''
            }
        }
        stage('Detect Changes') {
            steps {
                withCredentials([usernamePassword(credentialsId: 'aws-credentials', passwordVariable: 'AWS_SECRET_ACCESS_KEY', usernameVariable: 'AWS_ACCESS_KEY_ID')]) {
                    script {
                        // If this is the first build, assume everything changed
                        if (env.GIT_PREVIOUS_SUCCESSFUL_COMMIT == null) {
                            env.FRONTEND_CHANGED = 'true'
                            env.BACKEND_CHANGED = 'true'
                        } else {
                            def changedFiles = sh(script: "git diff --name-only ${env.GIT_PREVIOUS_SUCCESSFUL_COMMIT} ${env.GIT_COMMIT}", returnStdout: true).trim()
                            env.FRONTEND_CHANGED = changedFiles.contains('frontend/') ? 'true' : 'false'
                            env.BACKEND_CHANGED = changedFiles.contains('backend/') ? 'true' : 'false'
                        }
                        
                        // Set individual image tags for services that changed
                        def newTag = "${env.BUILD_NUMBER}-${env.GIT_COMMIT.take(7)}"
                        
                        // Get the latest successful tags from SSM Parameter Store only if not changed
                        if (env.BACKEND_CHANGED == 'true') {
                            env.BACKEND_IMAGE_TAG = newTag
                        } else {
                            def previousBackendTag = sh(
                                script: "aws ssm get-parameter --name /awad/prod/backend/image_tag --region ${AWS_DEFAULT_REGION} --query 'Parameter.Value' --output text 2>/dev/null || echo 'latest'",
                                returnStdout: true
                            ).trim()
                            env.BACKEND_IMAGE_TAG = previousBackendTag
                        }
                        
                        if (env.FRONTEND_CHANGED == 'true') {
                            env.FRONTEND_IMAGE_TAG = newTag
                        } else {
                            def previousFrontendTag = sh(
                                script: "aws ssm get-parameter --name /awad/prod/frontend/image_tag --region ${AWS_DEFAULT_REGION} --query 'Parameter.Value' --output text 2>/dev/null || echo 'latest'",
                                returnStdout: true
                            ).trim()
                            env.FRONTEND_IMAGE_TAG = previousFrontendTag
                        }
                        
                        echo "Frontend changed: ${env.FRONTEND_CHANGED}"
                        echo "Backend changed: ${env.BACKEND_CHANGED}"
                        echo "Backend Image Tag: ${env.BACKEND_IMAGE_TAG}"
                        echo "Frontend Image Tag: ${env.FRONTEND_IMAGE_TAG}"
                    }
                }
            }
        }

        stage('Build & Test') {
            parallel {
                stage('Build Backend') {
                    when { expression { return env.BACKEND_CHANGED == 'true' } }
                    steps {
                        dir('backend') {
                            sh 'npm install'
                            sh 'npm run build'
                        // sh 'npm test'
                        }
                    }
                }

                stage('Build Frontend') {
                    when { expression { return env.FRONTEND_CHANGED == 'true' } }
                    steps {
                        dir('frontend') {
                            sh 'npm install'
                            sh 'npm run build'
                        // sh 'npm run lint'
                        }
                    }
                }
            }
        }

        stage('Build Docker Images') {
            steps {
                script {
                    if (env.BACKEND_CHANGED == 'true') {
                        sh "docker build -t ${ECR_REPO_BACKEND}:${BACKEND_IMAGE_TAG} ./backend"
                    }
                    if (env.FRONTEND_CHANGED == 'true') {
                        sh "docker build -t ${ECR_REPO_FRONTEND}:${FRONTEND_IMAGE_TAG} ./frontend"
                    }
                }
            }
        }

        stage('Push to ECR') {
            steps {
                withCredentials([usernamePassword(credentialsId: 'aws-credentials', passwordVariable: 'AWS_SECRET_ACCESS_KEY', usernameVariable: 'AWS_ACCESS_KEY_ID')]) {
                    script {
                        sh "aws ecr get-login-password --region ${AWS_DEFAULT_REGION} | docker login --username AWS --password-stdin ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_DEFAULT_REGION}.amazonaws.com"

                        if (env.BACKEND_CHANGED == 'true') {
                            def repoUrl = "${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_DEFAULT_REGION}.amazonaws.com/${ECR_REPO_BACKEND}"
                            sh "docker tag ${ECR_REPO_BACKEND}:${BACKEND_IMAGE_TAG} ${repoUrl}:${BACKEND_IMAGE_TAG}"
                            sh "docker push ${repoUrl}:${BACKEND_IMAGE_TAG}"
                            // Also tag as 'latest' for fallback
                            sh "docker tag ${ECR_REPO_BACKEND}:${BACKEND_IMAGE_TAG} ${repoUrl}:latest"
                            sh "docker push ${repoUrl}:latest"
                            sh "docker rmi ${repoUrl}:${BACKEND_IMAGE_TAG}"
                            sh "docker rmi ${repoUrl}:latest"
                            sh "docker rmi ${ECR_REPO_BACKEND}:${BACKEND_IMAGE_TAG}"
                        }
                        if (env.FRONTEND_CHANGED == 'true') {
                            def repoUrl = "${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_DEFAULT_REGION}.amazonaws.com/${ECR_REPO_FRONTEND}"
                            sh "docker tag ${ECR_REPO_FRONTEND}:${FRONTEND_IMAGE_TAG} ${repoUrl}:${FRONTEND_IMAGE_TAG}"
                            sh "docker push ${repoUrl}:${FRONTEND_IMAGE_TAG}"
                            // Also tag as 'latest' for fallback
                            sh "docker tag ${ECR_REPO_FRONTEND}:${FRONTEND_IMAGE_TAG} ${repoUrl}:latest"
                            sh "docker push ${repoUrl}:latest"
                            sh "docker rmi ${repoUrl}:${FRONTEND_IMAGE_TAG}"
                            sh "docker rmi ${repoUrl}:latest"
                            sh "docker rmi ${ECR_REPO_FRONTEND}:${FRONTEND_IMAGE_TAG}"
                        }
                    }
                }
            }
        }

        stage('Provision Secrets') {
            steps {
                withCredentials([usernamePassword(credentialsId: 'aws-credentials', passwordVariable: 'AWS_SECRET_ACCESS_KEY', usernameVariable: 'AWS_ACCESS_KEY_ID')]) {
                    script {
                        def nodeScript = """
const fs = require('fs');
const { execSync } = require('child_process');

const secretId = process.env.AWS_SECRET_ID;
const region = process.env.AWS_DEFAULT_REGION;

function parseEnv(filePath) {
    const keys = {};
    if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8');
        content.split('\\n').forEach(line => {
            line = line.trim();
            if (line && !line.startsWith('#')) {
                const [key] = line.split('=');
                if (key) keys[key.trim()] = "CHANGE_ME";
            }
        });
    }
    return keys;
}

console.log("Collecting .env.example files...");
const newSecrets = {
    ...parseEnv('backend/.env.example'),
    ...parseEnv('frontend/.env.example')
};

if (Object.keys(newSecrets).length === 0) {
    console.log("No keys found.");
    process.exit(0);
}

let existingSecrets = {};
let secretExists = false;

try {
    const cmd = `aws secretsmanager get-secret-value --secret-id \${secretId} --region \${region} --query SecretString --output text`;
    const output = execSync(cmd, { stdio: ['pipe', 'pipe', 'ignore'] }).toString().trim();
    existingSecrets = JSON.parse(output);
    secretExists = true;
    console.log("Found existing secret.");
} catch (e) {
    console.log("Secret not found, will create new.");
}

const finalSecrets = { ...newSecrets, ...existingSecrets };

if (JSON.stringify(finalSecrets) === JSON.stringify(existingSecrets)) {
    console.log("No changes needed.");
    process.exit(0);
}

const secretString = JSON.stringify(finalSecrets);
fs.writeFileSync('secrets.json', secretString);

try {
    if (secretExists) {
        console.log("Updating secret...");
        execSync(`aws secretsmanager put-secret-value --secret-id \${secretId} --region \${region} --secret-string file://secrets.json`);
    } else {
        console.log("Creating secret...");
        execSync(`aws secretsmanager create-secret --name \${secretId} --region \${region} --secret-string file://secrets.json`);
    }
    console.log("Secrets provisioned.");
} catch (e) {
    console.error("Failed to update secrets:", e.message);
    process.exit(1);
}
"""
                        writeFile file: 'provision_secrets.js', text: nodeScript
                        sh 'node provision_secrets.js'
                        sh 'rm provision_secrets.js secrets.json || true'
                    }
                }
            }
        }

        stage('Deploy to EC2') {
            steps {
                withCredentials([usernamePassword(credentialsId: 'aws-credentials', passwordVariable: 'AWS_SECRET_ACCESS_KEY', usernameVariable: 'AWS_ACCESS_KEY_ID')]) {
                    sshagent(['ec2-ssh-key']) {
                        script {
                            // Get EC2 instance public IP dynamically
                            def ec2Ip = sh(
                                script: """
                                    aws ec2 describe-instances \
                                        --region ${AWS_DEFAULT_REGION} \
                                        --filters "Name=tag:Name,Values=${EC2_INSTANCE_TAG}" "Name=instance-state-name,Values=running" \
                                        --query 'Reservations[0].Instances[0].PublicIpAddress' \
                                        --output text
                                """,
                                returnStdout: true
                            ).trim()
                            
                            if (ec2Ip == 'None' || ec2Ip == '') {
                                error "Could not find running EC2 instance with tag Name=${EC2_INSTANCE_TAG}"
                            }
                            
                            def ec2Host = "ubuntu@${ec2Ip}"
                            echo "Deploying to EC2 instance: ${ec2Host}"
                            
                            // Copy docker-compose.prod.yml to EC2 as docker-compose.yml
                            sh "scp -o StrictHostKeyChecking=no docker-compose.prod.yml ${ec2Host}:~/docker-compose.yml"

                            // Deploy using the helper script installed by Terraform user_data
                            sh """
                                ssh -o StrictHostKeyChecking=no ${ec2Host} '
                                    export BACKEND_IMAGE_TAG=${BACKEND_IMAGE_TAG}
                                    export FRONTEND_IMAGE_TAG=${FRONTEND_IMAGE_TAG}
                                    export AWS_ACCOUNT_ID=${AWS_ACCOUNT_ID}
                                    export AWS_DEFAULT_REGION=${AWS_DEFAULT_REGION}

                                    # Login to ECR (still needed for pull)
                                    aws ecr get-login-password --region ${AWS_DEFAULT_REGION} | docker login --username AWS --password-stdin ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_DEFAULT_REGION}.amazonaws.com

                                    # Use the helper script to deploy
                                    # This fetches the secret, writes .env, and restarts compose
                                    /usr/local/bin/deploy-app.sh ${AWS_SECRET_ID}
                                '
                            """
                        }
                    }
                }
            }
        }
    }

    post {
        success {
            withCredentials([usernamePassword(credentialsId: 'aws-credentials', passwordVariable: 'AWS_SECRET_ACCESS_KEY', usernameVariable: 'AWS_ACCESS_KEY_ID')]) {
                script {
                    // Store the successful image tags in SSM Parameter Store for next build
                    echo "Storing image tags in SSM Parameter Store..."
                    
                    sh """
                        aws ssm put-parameter \
                            --name /awad/prod/backend/image_tag \
                            --value ${BACKEND_IMAGE_TAG} \
                            --type String \
                            --overwrite \
                            --region ${AWS_DEFAULT_REGION}
                    """
                    
                    sh """
                        aws ssm put-parameter \
                            --name /awad/prod/frontend/image_tag \
                            --value ${FRONTEND_IMAGE_TAG} \
                            --type String \
                            --overwrite \
                            --region ${AWS_DEFAULT_REGION}
                    """
                    
                    echo "Image tags stored successfully"
                }
            }
        }
        always {
            script {
                echo 'Cleaning up workspace...'
                // Clean up workspace
                cleanWs()
            }
        }
    }
}
