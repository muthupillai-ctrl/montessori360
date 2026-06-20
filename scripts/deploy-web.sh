#!/bin/bash

echo "Building Angular..."
npm run build -w apps/web

echo "Deploying to EC2..."

rsync -avz \
-e "ssh -i ~/.ssh/montessori3.pem" \
apps/web/dist/web/browser/ \
ubuntu@3.25.186.29:/tmp/montessori360/

ssh -i ~/.ssh/montessori3.pem ubuntu@3.25.186.29 << EOF
sudo rm -rf /var/www/montessori360/*
sudo cp -R /tmp/montessori360/* /var/www/montessori360/
sudo chown -R www-data:www-data /var/www/montessori360
sudo systemctl reload nginx
EOF

echo "Deployment complete."