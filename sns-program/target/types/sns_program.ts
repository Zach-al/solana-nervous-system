/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/sns_program.json`.
 */
export type SnsProgram = {
  "address": "3ibaKPYPhfuJNvGa2VZ6yTjjjegYFS1RkwjtfHJ5jjrR",
  "metadata": {
    "name": "snsProgram",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Solana Nervous System — on-chain node registry, staking, and payment settlement"
  },
  "instructions": [
    {
      "name": "registerNode",
      "discriminator": [
        102,
        85,
        117,
        114,
        194,
        188,
        211,
        168
      ],
      "accounts": [
        {
          "name": "owner",
          "writable": true,
          "signer": true
        },
        {
          "name": "nodeAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  110,
                  111,
                  100,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "owner"
              }
            ]
          }
        },
        {
          "name": "escrowAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  115,
                  99,
                  114,
                  111,
                  119
                ]
              },
              {
                "kind": "account",
                "path": "owner"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "endpoint",
          "type": "string"
        },
        {
          "name": "stakeAmount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "settlePayments",
      "discriminator": [
        228,
        137,
        157,
        218,
        144,
        171,
        119,
        92
      ],
      "accounts": [
        {
          "name": "owner",
          "writable": true,
          "signer": true
        },
        {
          "name": "nodeAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  110,
                  111,
                  100,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "owner"
              }
            ]
          }
        },
        {
          "name": "escrowAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  115,
                  99,
                  114,
                  111,
                  119
                ]
              },
              {
                "kind": "account",
                "path": "owner"
              }
            ]
          }
        },
        {
          "name": "nonceAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  110,
                  111,
                  110,
                  99,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "owner"
              },
              {
                "kind": "arg",
                "path": "instructionNonce"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "receipts",
          "type": {
            "vec": {
              "defined": {
                "name": "paymentReceipt"
              }
            }
          }
        },
        {
          "name": "instructionTimestamp",
          "type": "i64"
        },
        {
          "name": "instructionNonce",
          "type": "u64"
        }
      ]
    },
    {
      "name": "slashNode",
      "discriminator": [
        165,
        178,
        153,
        22,
        241,
        166,
        114,
        236
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "owner",
          "writable": true
        },
        {
          "name": "programAuthority",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  117,
                  116,
                  104,
                  111,
                  114,
                  105,
                  116,
                  121
                ]
              }
            ]
          }
        },
        {
          "name": "nodeAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  110,
                  111,
                  100,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "owner"
              }
            ]
          }
        },
        {
          "name": "escrowAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  115,
                  99,
                  114,
                  111,
                  119
                ]
              },
              {
                "kind": "account",
                "path": "owner"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "reason",
          "type": "string"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "nodeAccount",
      "discriminator": [
        125,
        166,
        18,
        146,
        195,
        127,
        86,
        220
      ]
    },
    {
      "name": "nonceAccount",
      "discriminator": [
        110,
        202,
        133,
        201,
        147,
        206,
        238,
        84
      ]
    }
  ],
  "events": [
    {
      "name": "nodeRegistered",
      "discriminator": [
        15,
        57,
        183,
        59,
        93,
        55,
        157,
        195
      ]
    },
    {
      "name": "nodeSlashed",
      "discriminator": [
        195,
        114,
        214,
        16,
        173,
        73,
        177,
        87
      ]
    },
    {
      "name": "paymentSettled",
      "discriminator": [
        158,
        182,
        152,
        76,
        105,
        23,
        232,
        135
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "nodeAlreadyRegistered",
      "msg": "Node is already registered"
    },
    {
      "code": 6001,
      "name": "insufficientStake",
      "msg": "Insufficient stake (minimum 0.1 SOL required)"
    },
    {
      "code": 6002,
      "name": "invalidReceipt",
      "msg": "Invalid or empty payment receipt"
    },
    {
      "code": 6003,
      "name": "unauthorized",
      "msg": "Caller is not authorized"
    },
    {
      "code": 6004,
      "name": "nodeNotFound",
      "msg": "Node not found or not initialized"
    },
    {
      "code": 6005,
      "name": "invalidEndpoint",
      "msg": "Endpoint string too long (max 100 chars)"
    },
    {
      "code": 6006,
      "name": "overflow",
      "msg": "Math overflow"
    },
    {
      "code": 6007,
      "name": "reentrancy",
      "msg": "Reentrancy detected"
    },
    {
      "code": 6008,
      "name": "replayAttack",
      "msg": "Replay attack detected"
    },
    {
      "code": 6009,
      "name": "nonceAlreadyUsed",
      "msg": "Nonce already used"
    },
    {
      "code": 6010,
      "name": "insufficientEscrow",
      "msg": "Insufficient escrow balance"
    },
    {
      "code": 6011,
      "name": "nodeSlashed",
      "msg": "Node has been slashed"
    },
    {
      "code": 6012,
      "name": "timestampExpired",
      "msg": "Timestamp expired"
    },
    {
      "code": 6013,
      "name": "invalidSignature",
      "msg": "Invalid signature"
    },
    {
      "code": 6014,
      "name": "accountFrozen",
      "msg": "Account is frozen"
    }
  ],
  "types": [
    {
      "name": "nodeAccount",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "endpoint",
            "type": "string"
          },
          {
            "name": "stakeAmount",
            "type": "u64"
          },
          {
            "name": "reputation",
            "type": "u8"
          },
          {
            "name": "registeredAt",
            "type": "i64"
          },
          {
            "name": "requestsServed",
            "type": "u64"
          },
          {
            "name": "isInitialized",
            "type": "bool"
          },
          {
            "name": "locked",
            "type": "bool"
          },
          {
            "name": "lastReceiptNonce",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "nodeRegistered",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "endpoint",
            "type": "string"
          },
          {
            "name": "stakeAmount",
            "type": "u64"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "nodeSlashed",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "reason",
            "type": "string"
          },
          {
            "name": "prevReputation",
            "type": "u8"
          },
          {
            "name": "newReputation",
            "type": "u8"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "nonceAccount",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "isUsed",
            "type": "bool"
          },
          {
            "name": "nonceValue",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "paymentReceipt",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "client",
            "type": "pubkey"
          },
          {
            "name": "amountLamports",
            "type": "u64"
          },
          {
            "name": "nonce",
            "type": "u64"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "paymentSettled",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "totalLamports",
            "type": "u64"
          },
          {
            "name": "receiptCount",
            "type": "u64"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    }
  ]
};
