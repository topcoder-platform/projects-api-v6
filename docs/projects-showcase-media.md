# CloudFront Signed URLs + Private S3 Setup

## Purpose

This document describes how to configure a private S3 bucket that is
only accessible through CloudFront using CloudFront Signed URLs.

The application authenticates users with JWTs. CloudFront **does not**
validate JWTs directly. Instead:

1.  The backend validates the JWT.
2.  The backend generates a short-lived CloudFront signed URL.
3.  CloudFront validates the signature.
4.  CloudFront retrieves the object from the private S3 bucket using an
    Origin Access Control (OAC).

------------------------------------------------------------------------

# Architecture

``` text
Browser
    |
    | JWT
    v
Projects API
    |
    | Verify JWT
    | Generate CloudFront Signed URL
    v
Browser
    |
    | GET https://cdn.example.com/path/file.ext?...Signature...
    v
CloudFront
    |
    | Validate signature
    | (automatic)
    v
Origin Access Control (OAC)
    |
    | SigV4 request
    v
Private S3 Bucket
```

------------------------------------------------------------------------

# S3 Configuration

## Bucket

-   Enable **Block all public access**.
-   Do not use public ACLs.
-   Do not add bucket policies granting `Principal: "*"` read access.

## Bucket Policy

Replace the placeholders before applying.

``` json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowCloudFrontServicePrincipal",
      "Effect": "Allow",
      "Principal": {
        "Service": "cloudfront.amazonaws.com"
      },
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::YOUR_BUCKET/*",
      "Condition": {
        "StringEquals": {
          "AWS:SourceArn": "arn:aws:cloudfront::YOUR_ACCOUNT_ID:distribution/YOUR_DISTRIBUTION_ID"
        }
      }
    }
  ]
}
```

------------------------------------------------------------------------

# CloudFront Configuration

## 1. Origin Access Control

Create:

    CloudFront
    └── Origin access
        └── Origin access controls

Configuration:

-   Origin type: S3
-   Signing behavior: Sign requests
-   Signing protocol: SigV4

Attach the OAC to the S3 origin.

------------------------------------------------------------------------

## 2. RSA Key Pair

Generate locally:

``` bash
openssl genrsa -out private_key.pem 2048

openssl rsa \
  -pubout \
  -in private_key.pem \
  -out public_key.pem
```

Never commit `private_key.pem`.

------------------------------------------------------------------------

## 3. Public Key

    CloudFront
    └── Security
        └── Public Keys

Create a Public Key and paste the contents of `public_key.pem`.

Record the generated **Key Pair ID**.

------------------------------------------------------------------------

## 4. Key Group

    CloudFront
    └── Security
        └── Key Groups

Create a Key Group containing the Public Key.

------------------------------------------------------------------------

## 5. Distribution

Edit the protected behavior.

Configure:

-   Viewer protocol policy: Redirect HTTP to HTTPS
-   Trusted Key Groups: Select the Key Group created above

Once configured, CloudFront automatically:

-   rejects unsigned requests
-   rejects expired requests
-   rejects requests signed with an unknown key

No Lambda or custom verification logic is required.

------------------------------------------------------------------------

# Parameter Store

Store the following values in AWS Systems Manager Parameter Store.

    /config/projects-api-v6/appvar/CLOUDFRONT_PROJECT_SHOWCASE_MEDIA_PRIVATE_KEY
    /config/projects-api-v6/appvar/CLOUDFRONT_PROJECT_SHOWCASE_MEDIA_PUBLIC_KEY
    /config/projects-api-v6/appvar/CLOUDFRONT_PROJECT_SHOWCASE_MEDIA_KEY_PAIR_ID

Recommended types:

| Parameter | Type | Notes |
|---|---|---|
| CLOUDFRONT_PROJECT_SHOWCASE_MEDIA_PRIVATE_KEY | SecureString | PEM contents of private key |
| CLOUDFRONT_PROJECT_SHOWCASE_MEDIA_PUBLIC_KEY | String | PEM contents of public key |
| CLOUDFRONT_PROJECT_SHOWCASE_MEDIA_KEY_PAIR_ID | String | CloudFront Key Pair ID |

The application should read these values at startup and never hardcode
or commit them.

------------------------------------------------------------------------

# Backend

Install:

``` bash
npm install @aws-sdk/cloudfront-signer
```

Example:

``` ts
import { getSignedUrl } from "@aws-sdk/cloudfront-signer";

const signedUrl = getSignedUrl({
  url,
  keyPairId: process.env.CLOUDFRONT_PROJECT_SHOWCASE_MEDIA_KEY_PAIR_ID!,
  privateKey: process.env.CLOUDFRONT_PROJECT_SHOWCASE_MEDIA_PRIVATE_KEY!,
  dateLessThan: new Date(Date.now() + 5 * 60 * 1000).toISOString()
});
```

`getSignedUrl()` performs local cryptographic signing only. It does not
make any AWS API calls.

------------------------------------------------------------------------

# Request Flow

``` text
Client
   │
   ├── JWT
   ▼
Projects API
   │
   ├── Verify JWT
   ├── getSignedUrl()
   ▼
Signed URL
   │
   ▼
CloudFront
   │
   ├── Validate signature
   ├── Validate expiration
   ▼
S3 (via OAC)
```

------------------------------------------------------------------------

# Validation

Expected results:

  Request                                 Expected
  --------------------------------------- -------------------
  Direct S3 URL                           403 Access Denied
  CloudFront URL without signature        403 Forbidden
  CloudFront URL with invalid signature   403 Forbidden
  CloudFront URL with expired signature   403 Forbidden
  CloudFront URL with valid signature     200 OK

------------------------------------------------------------------------

# Key Rotation

1.  Generate a new RSA key pair.
2.  Create a new CloudFront Public Key.
3.  Add the new Public Key to the existing Key Group.
4.  Update Parameter Store with the new private key and key pair ID.
5.  Deploy the backend.
6.  Wait until all previously issued signed URLs have expired.
7.  Remove the old Public Key from the Key Group.
8.  Delete the old key material if no longer required.

This sequence avoids downtime during key rotation.

------------------------------------------------------------------------

# Security Checklist

-   Block Public Access enabled.
-   No public bucket policy.
-   OAC attached to the S3 origin.
-   Bucket policy only permits the CloudFront distribution.
-   Private key stored as SecureString in Parameter Store.
-   Private key never committed to source control.
-   Signed URLs expire after a short period (recommended: 5--15
    minutes).
