use std::collections::HashMap;
use std::sync::Mutex;
use std::time::{Duration, Instant};

#[derive(Clone)]
struct RateLimitBucket {
    tokens: f64,
    last_refill: Instant,
    max_tokens: f64,
    refill_rate: f64,
}

pub struct ProviderRateLimiter {
    buckets: Mutex<HashMap<String, RateLimitBucket>>,
}

impl ProviderRateLimiter {
    pub fn new() -> Self {
        Self {
            buckets: Mutex::new(HashMap::new()),
        }
    }

    pub fn configure(&self, provider: &str, max_tokens: f64, refill_rate_per_sec: f64) {
        let mut buckets = self.buckets.lock().unwrap();
        buckets.insert(
            provider.to_string(),
            RateLimitBucket {
                tokens: max_tokens,
                last_refill: Instant::now(),
                max_tokens,
                refill_rate: refill_rate_per_sec,
            },
        );
    }

    pub fn wait_for_token(&self, provider: &str) -> Duration {
        let mut buckets = self.buckets.lock().unwrap();
        let bucket = match buckets.get_mut(provider) {
            Some(b) => b,
            None => return Duration::ZERO,
        };

        let now = Instant::now();
        let elapsed = now.duration_since(bucket.last_refill).as_secs_f64();
        bucket.tokens = (bucket.tokens + elapsed * bucket.refill_rate).min(bucket.max_tokens);
        bucket.last_refill = now;

        if bucket.tokens >= 1.0 {
            bucket.tokens -= 1.0;
            Duration::ZERO
        } else {
            let wait_secs = (1.0 - bucket.tokens) / bucket.refill_rate;
            bucket.tokens = 0.0;
            Duration::from_secs_f64(wait_secs)
        }
    }

    pub fn on_rate_limited(&self, provider: &str, retry_after: Option<Duration>) {
        let mut buckets = self.buckets.lock().unwrap();
        if let Some(bucket) = buckets.get_mut(provider) {
            bucket.tokens = 0.0;
            if let Some(wait) = retry_after {
                bucket.last_refill = Instant::now() + wait;
            }
        }
    }

    pub fn backoff(&self, _provider: &str, attempt: u32) -> Duration {
        let base = Duration::from_secs(1);
        let max = Duration::from_secs(30);
        let multiplier = 2u32.saturating_pow(attempt.min(4));
        let delay = base * multiplier;
        if delay > max { max } else { delay }
    }
}

impl Default for ProviderRateLimiter {
    fn default() -> Self {
        Self::new()
    }
}
