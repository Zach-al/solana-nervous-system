use criterion::{
    black_box, criterion_group, 
    criterion_main, Criterion
};
use sns_daemon::latency_engine::LatencyEngine;
use sns_daemon::attack_prevention::AttackPrevention;

fn bench_cache_hit(c: &mut Criterion) {
    let engine = LatencyEngine::new(10);
    
    // Prime the cache
    engine.set_cache(
        "getSlot",
        &serde_json::json!([]),
        serde_json::json!({"result": 454758049}),
    );
    
    c.bench_function("cache_hit_getSlot", |b| {
        b.iter(|| {
            black_box(engine.get_cached(
                "getSlot",
                &serde_json::json!([]),
            ))
        })
    });
}

fn bench_rate_limit_check(c: &mut Criterion) {
    let prevention = AttackPrevention::new();
    
    c.bench_function("rate_limit_check", |b| {
        b.iter(|| {
            black_box(prevention.check_rate_limit(
                black_box("192.168.1.1")
            ))
        })
    });
}

criterion_group!(
    benches, 
    bench_cache_hit,
    bench_rate_limit_check,
);
criterion_main!(benches);
