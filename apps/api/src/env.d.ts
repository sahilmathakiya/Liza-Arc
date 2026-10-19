declare global {
  interface Env {
    DATABASE_URL: string;
    BETTER_AUTH_SECRET: string;
    BETTER_AUTH_URL: string;
    GOOGLE_CLIENT_ID: string;
    GOOGLE_CLIENT_SECRET: string;
    WEB_URL: string;
    ADMIN_KEY: string;
    RAZORPAY_KEY_ID: string;
    RAZORPAY_KEY_SECRET: string;
    RAZORPAY_WEBHOOK_SECRET: string;
    BUCKET: R2Bucket;
    IMAGES: ImagesBinding;

    /** Presigned direct-to-R2 uploads (S3 API credentials, set as secrets). */
    CF_ACCOUNT_ID: string;
    R2_ACCESS_KEY_ID: string;
    R2_SECRET_ACCESS_KEY: string;
    R2_BUCKET_NAME: string;

    RL_AUTH: RateLimit;
    RL_ADMIN_SIGNUP: RateLimit;
    RL_ADMIN_WRITE: RateLimit;
    RL_UPLOAD: RateLimit;
    RL_THUMB_USER: RateLimit;
    RL_THUMB_PRODUCT: RateLimit;
    RL_PUBLIC_ASSETS: RateLimit;
    RL_DOWNLOAD: RateLimit;
    RL_CHECKOUT: RateLimit;
    RL_CHECKOUT_VERIFY: RateLimit;
    RL_ACCOUNT: RateLimit;
    RL_WEBHOOK: RateLimit;
  }
}

export {};
