#![no_std]

use quickex::types::HookEventKind;
use soroban_sdk::{contract, contractimpl, contracttype, symbol_short, Address, BytesN, Env};

#[contract]
pub struct ReferenceHook;

#[contracttype]
#[derive(Clone, Default)]
pub struct HookStats {
    pub total_events: u32,
    pub created: u32,
    pub settled: u32,
    pub refunded: u32,
}

#[contractimpl]
impl ReferenceHook {
    pub fn on_escrow_event(
        env: Env,
        event_kind: u32,
        _escrow_id: BytesN<32>,
        _owner: Address,
        _token: Address,
        _amount: i128,
        _fee: i128,
    ) {
        let mut stats: HookStats = env
            .storage()
            .persistent()
            .get(&symbol_short!("stats"))
            .unwrap_or_default();

        stats.total_events += 1;

        if event_kind == HookEventKind::Create as u32 {
            stats.created += 1;
        } else if event_kind == HookEventKind::Settle as u32 {
            stats.settled += 1;
        } else if event_kind == HookEventKind::Refund as u32 {
            stats.refunded += 1;
        }

        env.storage()
            .persistent()
            .set(&symbol_short!("stats"), &stats);
    }

    pub fn get_stats(env: Env) -> HookStats {
        env.storage()
            .persistent()
            .get(&symbol_short!("stats"))
            .unwrap_or_default()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn it_works() {
        let result = add(2, 2);
        assert_eq!(result, 4);
    }
}
