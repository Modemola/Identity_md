// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {KeptVault} from "../src/KeptVault.sol";

/// @dev Local CREATE2 probe only. No connection to or calls to the live launch factory.
contract VaultLaunchProbe {
    error DeploymentFailed();

    function deploy(bytes memory code, bytes32 salt) external payable returns (address deployed) {
        assembly ("memory-safe") {
            deployed := create2(callvalue(), add(code, 32), mload(code), salt)
        }
        if (deployed == address(0)) revert DeploymentFailed();
    }

    function changePanel(KeptVault vault) external {
        vault.setPanel(15, 11);
    }
}

contract KeptVaultLaunchTest is Test {
    address constant OWNER = 0xD3336A7c8a7D8814C437196aBb16c4FE7aA7B016;
    address constant INTAKE = 0x1397434cd35e8a9C8aC312A61D3A285EB31dea56;
    address constant IMD = 0x5F7Bb59365ce557C26dbcAa4EE9d39A4b95B7127;
    address constant SIGNER = 0x5598Aa9146215Bc13eb26f2c692Ad1461Fd32982;
    bytes32 constant ACTION = 0x6f7261636c652e72657175657374406f7261636c652d31000000000000000000;

    VaultLaunchProbe probe;
    bytes initCode;

    function setUp() public {
        vm.chainId(4663);
        probe = new VaultLaunchProbe();
        initCode = bytes.concat(
            vm.getCode("KeptVault.sol:KeptVault"),
            abi.encode(OWNER, INTAKE, IMD, ACTION, SIGNER, uint16(9), uint16(7))
        );
    }

    function test_exactLaunchArgumentsDeployOnEmptyChainWithoutInitialization() public {
        assertEq(INTAKE.code.length, 0);
        assertEq(IMD.code.length, 0);
        assertEq(SIGNER.code.length, 0);
        assertLe(initCode.length, 49_152);
        bytes32 salt = keccak256("KEPT launch rehearsal");
        address predicted = address(
            uint160(
                uint256(keccak256(abi.encodePacked(bytes1(0xff), address(probe), salt, keccak256(initCode))))
            )
        );
        address launchWallet = makeAddr("launch caller");
        vm.prank(launchWallet, launchWallet);
        KeptVault vault = KeptVault(probe.deploy(initCode, salt));
        assertEq(address(vault), predicted);
        assertEq(address(vault).balance, 0);
        assertEq(vault.owner(), OWNER);
        assertEq(address(vault.intake()), INTAKE);
        assertEq(address(vault.imd()), IMD);
        assertEq(vault.action(), ACTION);
        assertEq(vault.oracleSigner(), SIGNER);
        assertEq(vault.panelSize(), 9);
        assertEq(vault.quorum(), 7);
        assertEq(vault.pledgeCount(), 0);
        assertEq(vault.totalBudgets(), 0);
        assertEq(vault.refereeFund(), 0);

        vm.expectRevert(KeptVault.OnlyOwner.selector);
        probe.changePanel(vault);
        vm.prank(launchWallet);
        vm.expectRevert(KeptVault.OnlyOwner.selector);
        vault.setPanel(15, 11);
        vm.prank(OWNER);
        vault.setPanel(15, 11);
        assertEq(vault.panelSize(), 15);
    }

    function test_runtimeFitsAndHasNoForbiddenOpcodes() public {
        address deployed = probe.deploy(initCode, keccak256("runtime"));
        bytes memory code = deployed.code;
        assertGt(code.length, 0);
        assertLe(code.length, 24_576);
        for (uint256 i; i < code.length; ++i) {
            uint8 op = uint8(code[i]);
            if (op >= 0x60 && op <= 0x7f) {
                i += op - 0x5f;
                continue;
            }
            assertTrue(op != 0xf4 && op != 0xf2 && op != 0xff, "forbidden runtime opcode");
            assertTrue(op != 0xf0 && op != 0xf5, "vault must not deploy other contracts");
        }
    }

    function test_constructorRejectsNativeValue() public {
        vm.deal(address(this), 1);
        vm.expectRevert(VaultLaunchProbe.DeploymentFailed.selector);
        probe.deploy{value: 1}(initCode, keccak256("value"));
    }
}
