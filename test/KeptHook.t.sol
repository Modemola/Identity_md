// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {HookFixture} from "./helpers/HookFixture.sol";
import {HookFlags} from "../src/libraries/HookFlags.sol";
import {KeptHook} from "../src/KeptHook.sol";
import {KeptToken} from "../src/KeptToken.sol";
import {MockERC20} from "./mocks/MockERC20.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "v4-core/src/types/PoolKey.sol";
import {Currency} from "v4-core/src/types/Currency.sol";
import {BalanceDelta} from "v4-core/src/types/BalanceDelta.sol";
import {SwapParams} from "v4-core/src/types/PoolOperation.sol";
import {IHooks} from "v4-core/src/interfaces/IHooks.sol";

contract KeptHookTest is HookFixture {
    function test_feeSchedule() public {
        assertEq(hook.openedAt(), OPEN);
        for (uint256 t; t <= 1800; t += 7) {
            vm.warp(OPEN + t);
            assertEq(hook.feeNow(), 100 + (1900 * (1800 - t)) / 1800);
        }
        vm.warp(OPEN + 1800);
        assertEq(hook.feeNow(), 100);
        vm.warp(type(uint64).max);
        assertEq(hook.feeNow(), 100);
    }

    function test_allModesAtOpeningMidpointAndAfter() public {
        uint256[5] memory times = [uint256(0), 1, 900, 1800, 86400];
        for (uint256 t; t < times.length; ++t) {
            vm.warp(OPEN + times[t]);
            _checkedSwap(true, true, 1e18, false);
            _checkedSwap(true, false, 1e18, false);
            _checkedSwap(false, true, 1e18, false);
            _checkedSwap(false, false, 1e18, false);
        }
    }

    function testFuzz_feeAndPartialFills(bool buy, bool exactIn, uint96 size, uint32 time, bool limited)
        public
    {
        vm.warp(OPEN + bound(time, 0, 3600));
        _checkedSwap(buy, exactIn, bound(size, 1, 1e25), limited);
    }

    function testFuzz_crossTicks(bool buy, bool exactIn, uint96 size, uint16 time) public {
        router.seed(key, -120, 120, 1e25);
        router.seed(key, -360, 360, 1e25);
        vm.warp(OPEN + bound(time, 0, 3600));
        _checkedSwap(buy, exactIn, bound(size, 1e24, 9e26), false);
    }

    function test_partialFillsAllModes() public {
        for (uint256 t; t < 2; ++t) {
            vm.warp(OPEN + t * 1800);
            _checkedSwap(true, true, 1e25, true);
            _checkedSwap(true, false, 1e25, true);
            _checkedSwap(false, true, 1e25, true);
            _checkedSwap(false, false, 1e25, true);
        }
    }

    function test_sweepFundsTheReferee() public {
        vm.warp(OPEN + 1800);
        uint256 a = _checkedSwap(true, true, 100e18, false);
        uint256 b = _checkedSwap(false, true, 100e18, false);
        assertGt(a + b, 0);
        vm.prank(address(0xCAFE));
        uint256 swept = hook.sweep();
        assertEq(swept, a + b);
        assertEq(vault.refereeFund(), a + b);
        assertEq(imd.balanceOf(address(vault)), a + b);
        assertEq(hook.pending(), 0);
        assertEq(hook.sweep(), 0, "nothing left");
    }

    function test_sweepIncludesDirectDonations() public {
        imd.transfer(address(hook), 3e18);
        assertEq(hook.sweep(), 3e18);
        assertEq(vault.refereeFund(), 3e18);
    }

    function test_sweepDuringUnlockDefers() public {
        _checkedSwap(true, true, 1e18, false);
        router.sweepDuringUnlock(key);
        assertGt(hook.pending(), 0);
        hook.sweep();
        assertEq(hook.pending(), 0);
    }

    function test_callbacksOnlyManager() public {
        SwapParams memory p = _params(true, true, 1e18, false);
        vm.expectRevert(KeptHook.OnlyPoolManager.selector);
        hook.beforeSwap(address(this), key, p, "");
        vm.expectRevert(KeptHook.OnlyPoolManager.selector);
        hook.afterSwap(address(this), key, p, BalanceDelta.wrap(0), "");
        vm.expectRevert(KeptHook.OnlyPoolManager.selector);
        hook.beforeInitialize(address(this), key, ONE);
        vm.expectRevert(KeptHook.OnlyPoolManager.selector);
        hook.unlockCallback("");
    }

    function test_onlyOnePoolEver() public {
        PoolKey memory other = key;
        other.tickSpacing = 120;
        vm.expectRevert();
        manager.initialize(other, ONE);
    }

    function test_onlyFactoryInitializes() public {
        address at = address(uint160(0x4b455054000000000000000000000000000001) << 14 | HookFlags.KEPT);
        deployCodeTo(
            "KeptHook.sol:KeptHook",
            abi.encode(manager, address(imd), address(kept), address(vault), address(0xFAC)),
            at
        );
        PoolKey memory other = key;
        other.hooks = IHooks(at);
        vm.expectRevert();
        manager.initialize(other, ONE);
        assertFalse(KeptHook(at).initialized());
        vm.prank(address(0xFAC));
        manager.initialize(other, ONE);
        assertTrue(KeptHook(at).initialized());
    }

    function test_permissionBits() public view {
        assertTrue(HookFlags.matches(address(hook), HookFlags.KEPT));
        assertEq(uint160(address(hook)) & HookFlags.ALL, 0x20cc);
    }

    function test_constructorRejectsBadConfig() public {
        vm.expectRevert(KeptHook.InvalidConfiguration.selector);
        new KeptHook(manager, address(imd), address(imd), address(vault), address(this));
        vm.expectRevert(KeptHook.InvalidConfiguration.selector);
        new KeptHook(manager, address(imd), address(kept), address(0), address(this));
        vm.expectRevert(KeptHook.InvalidConfiguration.selector);
        new KeptHook(manager, address(imd), address(kept), address(vault), address(0));
    }

    function test_noLiquidityNoFee() public {
        router.seed(key, -600, 600, -1e27);
        SwapParams memory p = _params(true, true, 1e18, false);
        router.swap(key, p);
        assertEq(hook.collected(), 0);
    }
}

contract KeptHookTokenFirstTest is KeptHookTest {
    function _imdFirst() internal pure override returns (bool) {
        return false;
    }
}
