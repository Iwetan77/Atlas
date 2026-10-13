import type { TypedData } from '@/api/contract';

// The domain's own type, spelled out as EIP-712 asks (its fields in the standard order). Privy hands
// typed data to its signer as-is, and a signer that isn't told the domain's fields can hash it as an
// empty domain: the signature then belongs to no one and the approval is refused. A standard signer
// gives the same signature either way.
const DOMAIN_FIELDS = [
  ['name', 'string'],
  ['version', 'string'],
  ['chainId', 'uint256'],
  ['verifyingContract', 'address'],
  ['salt', 'bytes32'],
] as const;

export function withDomainType(typed: TypedData): TypedData {
  if (typed.types.EIP712Domain) return typed;
  const fields = DOMAIN_FIELDS.filter(([name]) => typed.domain[name] !== undefined).map(([name, type]) => ({ name, type }));
  return { ...typed, types: { ...typed.types, EIP712Domain: fields } };
}
