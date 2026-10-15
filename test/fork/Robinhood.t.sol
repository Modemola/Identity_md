// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test, Vm} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {IHooks} from "v4-core/src/interfaces/IHooks.sol";
import {PoolKey} from "v4-core/src/types/PoolKey.sol";
import {Currency} from "v4-core/src/types/Currency.sol";
import {SwapParams} from "v4-core/src/types/PoolOperation.sol";
import {TickMath} from "v4-core/src/libraries/TickMath.sol";
import {KeptVault} from "../../src/KeptVault.sol";
import {KeptHook} from "../../src/KeptHook.sol";
import {KeptToken} from "../../src/KeptToken.sol";
import {Questions} from "../../src/libraries/Questions.sol";
import {HookFlags} from "../../src/libraries/HookFlags.sol";
import {TestRouter} from "../helpers/TestRouter.sol";

/// @title Robinhood Chain rehearsal against the live Intake, IMD and Uniswap v4 PoolManager
/// @notice Opt-in. Skipped unless run on a Robinhood fork:
/// `forge test --match-contract RobinhoodForkTest --fork-url https://rpc.mainnet.chain.robinhood.com`
/// Nothing is broadcast; balances are synthetic (`deal`), contracts are the real deployments.
contract RobinhoodForkTest is Test {
    address constant INTAKE = 0x1397434cd35e8a9C8aC312A61D3A285EB31dea56;
    address constant IMD = 0x5F7Bb59365ce557C26dbcAa4EE9d39A4b95B7127;
    address constant MANAGER = 0x8366a39CC670B4001A1121B8F6A443A643e40951;
    address constant SIGNER = 0x5598Aa9146215Bc13eb26f2c692Ad1461Fd32982;
    bytes32 constant ACTION = 0x6f7261636c652e72657175657374406f7261636c652d31000000000000000000;
    bytes32 constant REQUESTED =
        keccak256("Requested(bytes32,address,bytes32,bytes,address,bytes4,address,uint256)");

    KeptVault vault;
    KeptToken kept;
    address team = makeAddr("team");

    function setUp() public {
        if (block.chainid != 4663) {
            vm.skip(true);
            return;
        }
        vault = new KeptVault(address(this), INTAKE, IMD, ACTION, SIGNER, 9, 7);
        kept = new KeptToken();
    }

    /// @notice A KEPT check is a real, paid Intake request whose event carries KEPT's exact body.
    function test_checkBuysARealOracleRequest() public {
        deal(IMD, team, 10 ether);
        kept.transfer(team, 1_000 ether);
        vm.startPrank(team);
        IERC20(IMD).approve(address(vault), type(uint256).max);
        kept.approve(address(vault), type(uint256).max);
        KeptVault.MilestoneInput[] memory ms = new KeptVault.MilestoneInput[](1);
        ms[0].kind = Questions.Kind.ContractDeployed;
        ms[0].deadline = uint64(block.timestamp + 1 days);
        ms[0].amount = 1_000 ether;
        ms[0].chainId = 4663;
        ms[0].target = INTAKE;
        ms[0].title = "Intake is deployed";
        uint256 id = vault.createPledge(IERC20(address(kept)), team, "fork rehearsal", ms, 1 ether);

        uint256 vaultBefore = IERC20(IMD).balanceOf(address(vault));
        vm.recordLogs();
        bytes32 rid = vault.check(id, 0);
        vm.stopPrank();
        assertTrue(rid != bytes32(0));
        assertEq(
            vaultBefore - IERC20(IMD).balanceOf(address(vault)), 0.5 ether, "paid exactly the live price"
        );
        assertEq(IERC20(IMD).allowance(address(vault), INTAKE), 0);

        Vm.Log[] memory logs = vm.getRecordedLogs();
        bool seen;
        for (uint256 i; i < logs.length; ++i) {
            if (logs[i].emitter != INTAKE || logs[i].topics[0] != REQUESTED) continue;
            assertEq(logs[i].topics[1], rid);
            assertEq(address(uint160(uint256(logs[i].topics[2]))), address(vault));
            (bytes memory body, address target, bytes4 selector,,) =
                abi.decode(logs[i].data, (bytes, address, bytes4, address, uint256));
            assertEq(string(body), vault.questionOf(id, 0));
            assertEq(target, address(vault));
            assertEq(selector, vault.onOracleResult.selector);
            seen = true;
        }
        assertTrue(seen, "Intake emitted Requested for the KEPT check");
    }

    /// @notice The hook trades and sweeps on Robinhood's real PoolManager with real IMD.
    function test_hookTradesAndFundsTheRefereeOnTheLivePoolManager() public {
        address at = address(uint160(0x4b4550540000000000000000000000000000) << 14 | HookFlags.KEPT);
        deployCodeTo(
            "KeptHook.sol:KeptHook",
            abi.encode(MANAGER, IMD, address(kept), address(vault), address(this)),
            at
        );
        KeptHook hook = KeptHook(at);
        bool imd0 = IMD < address(kept);
        PoolKey memory key = PoolKey(
            Currency.wrap(imd0 ? IMD : address(kept)),
            Currency.wrap(imd0 ? address(kept) : IMD),
            12500,
            60,
            IHooks(at)
        );
        IPoolManager(MANAGER).initialize(key, TickMath.getSqrtPriceAtTick(0));
        TestRouter router = new TestRouter(IPoolManager(MANAGER));
        deal(IMD, address(this), 1e24);
        IERC20(IMD).approve(address(router), type(uint256).max);
        kept.approve(address(router), type(uint256).max);
        router.seed(key, -600, 600, 1e24);

        vm.warp(block.timestamp + 1800);
        SwapParams memory buy =
            SwapParams(imd0, -1e18, TickMath.getSqrtPriceAtTick(imd0 ? int24(-1200) : int24(1200)));
        router.swap(key, buy);
        SwapParams memory sell =
            SwapParams(!imd0, -1e18, TickMath.getSqrtPriceAtTick(imd0 ? int24(1200) : int24(-1200)));
        router.swap(key, sell);
        uint256 fees = hook.collected();
        assertGt(fees, 0);
        assertEq(hook.sweep(), fees);
        assertEq(vault.refereeFund(), fees);
        assertEq(IERC20(IMD).balanceOf(address(vault)), fees);
    }
}
